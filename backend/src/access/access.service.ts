import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CodeStatus, GuideStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
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

@Injectable()
export class AccessService {
  private readonly logger = new Logger(AccessService.name);
  private readonly throttle = new Throttle();
  /** Avoid a DB write on literally every page view. */
  private readonly lastTouch = new Map<string, number>();

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

  /** Resolve a device token to its live access record. */
  private async authorize(token: string | undefined) {
    if (!token) throw new ForbiddenException('No access on this device');
    const code = await this.prisma.accessCode.findFirst({
      where: { deviceTokenHash: hashToken(token) },
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

  /** Everything the reader needs to render, minus anything sensitive. */
  async session(token: string | undefined) {
    const code = await this.authorize(token);
    const readable =
      code.guide.status === GuideStatus.READY && code.guide.published;

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
      },
      redeemedAt: code.redeemedAt,
      deviceLabel: code.deviceLabel,
    };
  }

  /** Stream one watermarked page for the authorised device. */
  async page(token: string | undefined, pageNumber: number) {
    const code = await this.authorize(token);
    const guide = code.guide;

    if (guide.status !== GuideStatus.READY || !guide.published) {
      throw new NotFoundException('This guide is not available right now.');
    }
    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > guide.pageCount
    ) {
      throw new NotFoundException('Page not found');
    }

    const key = `${guide.pagePrefix}/${String(pageNumber).padStart(4, '0')}.jpg`;
    const clean = await this.storage.get(key);
    const marked = await this.watermark.apply(clean, {
      buyerName: code.buyerName,
      buyerPhone: code.buyerPhone,
    });

    void this.touch(code.id);
    return marked;
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
