import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CodeStatus, GuideStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PAGE_EXTENSION, type OutlineEntry } from '../guides/pdf-render.service';
import {
  INDEX_FILE,
  THUMB_FOLDER,
  type GuideIndex,
} from '../guides/guides.service';
import { WatermarkService } from './watermark.service';
import { describeDevice, hashCode, hashToken, lastFour } from '../codes/code.util';

export interface RequestMeta {
  ip?: string;
  ua?: string;
}

/** Small in-memory throttle to blunt code-guessing from a single address. */
class Throttle {
  private hits = new Map<string, { count: number; resetAt: number }>();

  check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || now > entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count += 1;
    if (this.hits.size > 5000) this.sweep(now);
    return entry.count <= limit;
  }

  private sweep(now: number) {
    for (const [k, v] of this.hits) if (now > v.resetAt) this.hits.delete(k);
  }
}

/**
 * Watermarked pages held in memory. Pages are rasterised at reading resolution
 * and so run to a few hundred KB each; this bound keeps the shared pool near
 * 10MB even when several students are reading at once.
 */
const PAGE_CACHE_LIMIT = 24;

/**
 * How long an authorised device is trusted without re-querying Postgres.
 *
 * The database lives in another region, so a lookup per page request adds well
 * over a second to every image. Caching the authorisation makes page turns
 * feel instant; the cost is that a revoked or reset code can still be read for
 * up to this long, which is an acceptable trade for a reading session.
 */
const AUTH_TTL_MS = 30_000;

/**
 * Thumbnails are shared by every reader of a guide — they carry no watermark,
 * being far too small to read — so a modest pool covers whole navigators.
 */
const THUMB_CACHE_LIMIT = 400;

/** Search indexes are per guide version and a few hundred KB at most. */
const INDEX_CACHE_LIMIT = 8;

/** Cap on returned search hits, so a one-letter query can't return everything. */
const MAX_SEARCH_RESULTS = 80;

/** Characters of context shown around each search hit. */
const SNIPPET_RADIUS = 60;

export interface SearchHit {
  page: number;
  snippet: string;
  /** Offsets of the match within `snippet`, for highlighting in the reader. */
  from: number;
  to: number;
}

@Injectable()
export class AccessService {
  private readonly logger = new Logger(AccessService.name);
  private readonly throttle = new Throttle();
  /** Avoid a DB write on literally every page view. */
  private readonly lastTouch = new Map<string, number>();
  /** LRU of already-watermarked pages, keyed by buyer + guide version + page. */
  private readonly pageCache = new Map<string, Buffer>();
  /** Thumbnails, keyed by guide version + page. Shared across all buyers. */
  private readonly thumbCache = new Map<string, Buffer>();
  /** Parsed search indexes, keyed by guide version. */
  private readonly indexCache = new Map<string, GuideIndex>();
  /** Short-lived authorisation cache, so page turns skip the remote database. */
  private readonly authCache = new Map<
    string,
    { at: number; code: Awaited<ReturnType<AccessService['fetchAuthorized']>> }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly watermark: WatermarkService,
  ) {}

  private async logAttempt(code: string, reason: string, meta: RequestMeta) {
    await this.prisma.accessAttempt
      .create({
        data: {
          codeLast4: lastFour(code) || '????',
          reason,
          ip: meta.ip,
          ua: meta.ua,
        },
      })
      .catch(() => undefined);
  }

  /**
   * Redeem a one-time code and bind it to the calling browser.
   *
   * Claiming is done with a conditional update so two devices racing on the
   * same code can never both win.
   */
  async redeem(rawCode: string, meta: RequestMeta, presentedToken?: string) {
    const trimmed = (rawCode ?? '').trim();
    if (!trimmed) throw new BadRequestException('Enter your access code');

    if (!this.throttle.check(`redeem:${meta.ip ?? 'unknown'}`, 12, 10 * 60_000)) {
      throw new ForbiddenException(
        'Too many attempts. Please wait a few minutes and try again.',
      );
    }

    const codeHash = hashCode(trimmed);
    const existing = await this.prisma.accessCode.findUnique({
      where: { codeHash },
      include: { guide: true },
    });

    if (!existing) {
      await this.logAttempt(trimmed, 'NOT_FOUND', meta);
      throw new NotFoundException(
        "That code doesn't look right. Check it and try again.",
      );
    }

    if (
      existing.status === CodeStatus.DISABLED ||
      existing.status === CodeStatus.REVOKED
    ) {
      await this.logAttempt(trimmed, existing.status, meta);
      throw new ForbiddenException(
        'This code is no longer active. Please contact support.',
      );
    }

    if (existing.status === CodeStatus.REDEEMED) {
      // Same browser coming back — hand the session straight back.
      if (
        presentedToken &&
        existing.deviceTokenHash === hashToken(presentedToken)
      ) {
        return this.session(presentedToken);
      }
      await this.logAttempt(trimmed, 'ALREADY_REDEEMED', meta);
      throw new ForbiddenException(
        'This code has already been used on another device. If that was you, request access recovery below.',
      );
    }

    const token = randomBytes(32).toString('hex');
    const claimed = await this.prisma.accessCode.updateMany({
      where: { id: existing.id, status: CodeStatus.UNUSED },
      data: {
        status: CodeStatus.REDEEMED,
        deviceTokenHash: hashToken(token),
        deviceLabel: describeDevice(meta.ua),
        deviceUa: meta.ua?.slice(0, 400),
        deviceIp: meta.ip,
        redeemedAt: new Date(),
        lastAccessAt: new Date(),
        accessCount: 1,
      },
    });

    if (claimed.count === 0) {
      await this.logAttempt(trimmed, 'RACE_LOST', meta);
      throw new ForbiddenException(
        'This code was just used on another device.',
      );
    }

    this.logger.log(
      `Code ${existing.codeLast4} redeemed for guide ${existing.guide.courseCode}`,
    );
    return { ...(await this.session(token)), deviceToken: token };
  }

  private async fetchAuthorized(tokenHash: string) {
    const code = await this.prisma.accessCode.findFirst({
      where: { deviceTokenHash: tokenHash },
      include: { guide: true },
    });
    if (!code) throw new ForbiddenException('No access on this device');
    if (code.status !== CodeStatus.REDEEMED) {
      throw new ForbiddenException(
        'Your access has been withdrawn. Please contact support.',
      );
    }
    return code;
  }

  /**
   * Resolve a device token to its live access record, reusing a recent lookup
   * so a burst of page requests doesn't pay a cross-region query each time.
   */
  private async authorize(token: string | undefined, allowCache = true) {
    if (!token) throw new ForbiddenException('No access on this device');
    const tokenHash = hashToken(token);

    if (allowCache) {
      const hit = this.authCache.get(tokenHash);
      if (hit && Date.now() - hit.at < AUTH_TTL_MS) return hit.code;
    }

    const code = await this.fetchAuthorized(tokenHash);
    this.authCache.set(tokenHash, { at: Date.now(), code });
    if (this.authCache.size > 500) {
      const oldest = this.authCache.keys().next().value;
      if (oldest) this.authCache.delete(oldest);
    }
    return code;
  }

  /** Everything the reader needs to render, minus anything sensitive. */
  async session(token: string | undefined) {
    // Always read through: this drives the reader's page count, which grows
    // while a guide is still rendering, and must reflect a revoked code.
    const code = await this.authorize(token, false);
    // Pages are published as they render, so a long upload becomes readable
    // from page one instead of making the buyer wait for the whole document.
    const readable = code.guide.published && code.guide.pageCount > 0;

    return {
      buyer: { name: code.buyerName, phone: code.buyerPhone },
      guide: {
        id: code.guide.id,
        title: code.guide.title,
        courseCode: code.guide.courseCode,
        subject: code.guide.subject,
        description: code.guide.description,
        pageCount: readable ? code.guide.pageCount : 0,
        version: code.guide.version,
        ready: readable,
        /** True while more pages are still being added to this guide. */
        building: code.guide.status === GuideStatus.PROCESSING,
      },
      redeemedAt: code.redeemedAt,
      deviceLabel: code.deviceLabel,
    };
  }

  /** Stream one watermarked page for the authorised device. */
  async page(token: string | undefined, pageNumber: number) {
    const code = await this.authorize(token);
    const guide = code.guide;

    if (!guide.published || guide.pageCount === 0) {
      throw new NotFoundException('This guide is not available right now.');
    }
    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > guide.pageCount
    ) {
      throw new NotFoundException('Page not found');
    }

    // Watermarking costs more than reading the page, so serve repeat views
    // (re-scrolls, reloads) straight from memory.
    const cacheKey = `${code.id}:${guide.version}:${pageNumber}`;
    const cached = this.pageCache.get(cacheKey);
    if (cached) {
      // Refresh recency for the LRU.
      this.pageCache.delete(cacheKey);
      this.pageCache.set(cacheKey, cached);
      void this.touch(code.id);
      return cached;
    }

    // Guides rendered before pages moved to WebP still have .jpg masters, and
    // those stay readable: the watermark step re-encodes to one delivered
    // format either way, so only the lookup needs to know the difference.
    const stem = `${guide.pagePrefix}/${String(pageNumber).padStart(4, '0')}`;
    const key = `${stem}.${PAGE_EXTENSION}`;
    let clean: Buffer;
    try {
      clean = await this.storage.get(key);
    } catch {
      try {
        clean = await this.storage.get(`${stem}.jpg`);
      } catch (e) {
        // The guide is marked ready in the database but its rendered pages are
        // not in this instance's storage — almost always because pages were
        // rendered on another machine while storage is still on local disk.
        this.logger.error(
          `Missing page file "${key}" for guide ${guide.courseCode} ` +
            `(${guide.id}). Storage driver: ${this.storage.driver}. ` +
            `Re-upload the PDF, or configure Supabase Storage so every instance ` +
            `shares the same files. Cause: ${e instanceof Error ? e.message : e}`,
        );
        throw new ServiceUnavailableException(
          'This page is temporarily unavailable. Please contact support so we can restore it.',
        );
      }
    }

    const marked = await this.watermark.apply(clean, {
      buyerName: code.buyerName,
      buyerPhone: code.buyerPhone,
    });

    this.pageCache.set(cacheKey, marked);
    if (this.pageCache.size > PAGE_CACHE_LIMIT) {
      const oldest = this.pageCache.keys().next().value;
      if (oldest) this.pageCache.delete(oldest);
    }

    void this.touch(code.id);
    return marked;
  }

  /**
   * A page-navigator preview.
   *
   * Unlike a page these carry no watermark and are identical for every buyer,
   * so one cache entry serves everyone and no per-request encoding happens.
   * They are also optional: a guide rendered before thumbnails existed simply
   * has none, and the reader falls back to a page number.
   */
  async thumbnail(token: string | undefined, pageNumber: number) {
    const code = await this.authorize(token);
    const guide = code.guide;

    if (!guide.published || guide.pageCount === 0) {
      throw new NotFoundException('This guide is not available right now.');
    }
    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > guide.pageCount
    ) {
      throw new NotFoundException('Page not found');
    }

    const cacheKey = `${guide.id}:${guide.version}:${pageNumber}`;
    const cached = this.thumbCache.get(cacheKey);
    if (cached) {
      this.thumbCache.delete(cacheKey);
      this.thumbCache.set(cacheKey, cached);
      return cached;
    }

    // pagePrefix ends in "/pages"; thumbnails sit beside that folder.
    const versionBase = guide.pagePrefix.replace(/\/pages$/, '');
    const name = String(pageNumber).padStart(4, '0');

    let thumb: Buffer;
    try {
      thumb = await this.storage.get(
        `${versionBase}/${THUMB_FOLDER}/${name}.${PAGE_EXTENSION}`,
      );
    } catch {
      throw new NotFoundException('No preview for this page');
    }

    this.thumbCache.set(cacheKey, thumb);
    if (this.thumbCache.size > THUMB_CACHE_LIMIT) {
      const oldest = this.thumbCache.keys().next().value;
      if (oldest) this.thumbCache.delete(oldest);
    }
    return thumb;
  }

  /** The guide's table of contents, empty when the PDF carried no bookmarks. */
  async outline(token: string | undefined): Promise<OutlineEntry[]> {
    const code = await this.authorize(token);
    const index = await this.index(code.guide);
    return index?.outline ?? [];
  }

  /**
   * Find a phrase across the guide.
   *
   * Matching is plain case-insensitive substring search over the text pdf.js
   * extracted at render time. That is enough for the "where did the lecturer
   * define X" question students actually ask, and it keeps the whole feature
   * free of an index server.
   */
  async search(
    token: string | undefined,
    query: string,
  ): Promise<{ searchable: boolean; hits: SearchHit[] }> {
    const code = await this.authorize(token);
    const index = await this.index(code.guide);
    if (!index) return { searchable: false, hits: [] };

    const needle = (query ?? '').trim().toLowerCase();
    if (needle.length < 2) return { searchable: index.searchable, hits: [] };

    const hits: SearchHit[] = [];
    const pages = Object.keys(index.pages)
      .map(Number)
      .sort((a, b) => a - b);

    for (const page of pages) {
      const text = index.pages[String(page)] ?? '';
      const haystack = text.toLowerCase();
      let at = haystack.indexOf(needle);

      while (at !== -1 && hits.length < MAX_SEARCH_RESULTS) {
        const start = Math.max(0, at - SNIPPET_RADIUS);
        const end = Math.min(text.length, at + needle.length + SNIPPET_RADIUS);
        const prefix = start > 0 ? '…' : '';
        hits.push({
          page,
          snippet: prefix + text.slice(start, end) + (end < text.length ? '…' : ''),
          from: prefix.length + (at - start),
          to: prefix.length + (at - start) + needle.length,
        });
        at = haystack.indexOf(needle, at + needle.length);
      }
      if (hits.length >= MAX_SEARCH_RESULTS) break;
    }

    return { searchable: index.searchable, hits };
  }

  /** Load and cache one version's search index, or null if it has none. */
  private async index(guide: {
    id: string;
    version: number;
    pagePrefix: string;
  }): Promise<GuideIndex | null> {
    const cacheKey = `${guide.id}:${guide.version}`;
    const cached = this.indexCache.get(cacheKey);
    if (cached) return cached;

    const versionBase = guide.pagePrefix.replace(/\/pages$/, '');
    try {
      const raw = await this.storage.get(`${versionBase}/${INDEX_FILE}`);
      const parsed = JSON.parse(raw.toString('utf8')) as GuideIndex;
      if (!parsed || typeof parsed !== 'object') return null;

      const index: GuideIndex = {
        outline: Array.isArray(parsed.outline) ? parsed.outline : [],
        searchable: Boolean(parsed.searchable),
        pages: parsed.pages && typeof parsed.pages === 'object' ? parsed.pages : {},
      };

      this.indexCache.set(cacheKey, index);
      if (this.indexCache.size > INDEX_CACHE_LIMIT) {
        const oldest = this.indexCache.keys().next().value;
        if (oldest) this.indexCache.delete(oldest);
      }
      return index;
    } catch {
      // Guides rendered before search existed have no index; that is not an
      // error, it just means this guide offers neither search nor contents.
      return null;
    }
  }

  /** Record activity at most once a minute per code. */
  private async touch(id: string) {
    const now = Date.now();
    const last = this.lastTouch.get(id) ?? 0;
    if (now - last < 60_000) return;
    this.lastTouch.set(id, now);
    await this.prisma.accessCode
      .update({
        where: { id },
        data: { lastAccessAt: new Date(), accessCount: { increment: 1 } },
      })
      .catch(() => undefined);
  }
}
