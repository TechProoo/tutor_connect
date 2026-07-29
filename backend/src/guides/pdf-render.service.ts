import { Injectable, Logger } from '@nestjs/common';
import { createCanvas } from '@napi-rs/canvas';
import type { Sharp, SharpOptions } from 'sharp';

// sharp resolves to a CommonJS function at runtime despite its ESM types.
const sharp: (input?: Buffer | string, options?: SharpOptions) => Sharp =
  require('sharp');

/**
 * `pdfjs-dist` v6 ships as ESM only, but Nest compiles to CommonJS — a plain
 * `await import()` would be transpiled down to `require()` and fail. Building
 * the import through `new Function` keeps it a real dynamic import at runtime.
 */
const esmImport = new Function('s', 'return import(s)') as (
  s: string,
) => Promise<any>;

export interface RenderedPage {
  index: number;
  image: Buffer;
  /** Small preview for the page navigator. */
  thumbnail: Buffer;
  /** Page text, flattened to one line, for search. Empty for scanned pages. */
  text: string;
  width: number;
  height: number;
}

/** One entry of the PDF's own table of contents. */
export interface OutlineEntry {
  title: string;
  page: number;
  children: OutlineEntry[];
}

export interface RenderResult {
  total: number;
  outline: OutlineEntry[];
  /** True when at least one page yielded text, i.e. search is worth offering. */
  searchable: boolean;
}

/** Called as each page finishes, so callers can publish pages progressively. */
export type PageSink = (page: RenderedPage, total: number) => Promise<void>;

/**
 * Width, in device pixels, that pages are rasterised to. The reader shows a
 * page at up to 1080 CSS px, so a page needs roughly double that to stay sharp
 * on the 2x screens most students read on, and typed guides are re-read at
 * high zoom far more than a photographed page ever is.
 */
const TARGET_WIDTH = 2000;

/** Ceiling on the rasterisation factor, so a tiny page size can't explode. */
const MAX_SCALE = 4;

/**
 * Quality of the stored master, 0-100.
 *
 * This is a master, not the bytes students receive: every page is re-encoded
 * when the per-buyer watermark is burned in, so compress gently here and let
 * the serving path pick the delivered quality.
 */
const MASTER_QUALITY = 92;

/** Page navigator previews. Small enough that a 200-page guide stays cheap. */
const THUMB_WIDTH = 260;
const THUMB_QUALITY = 72;

/** Extension and MIME of a stored page, kept together so they can't drift. */
export const PAGE_EXTENSION = 'webp';
export const PAGE_CONTENT_TYPE = 'image/webp';

/** Guards against a pathological PDF filling storage with one huge text blob. */
const MAX_TEXT_PER_PAGE = 20_000;

@Injectable()
export class PdfRenderService {
  private readonly logger = new Logger(PdfRenderService.name);

  /**
   * Rasterise every page of a PDF, invoking `sink` after each one so pages can
   * be stored and served before the whole document is done.
   *
   * Pages are encoded as WebP rather than JPEG. Guide pages are mostly text on
   * white, which is the case JPEG handles worst — it rings around every glyph —
   * and measured on a real guide WebP came out under half the size at matching
   * quality. The canvas's own encoder is bypassed so the raw pixels go straight
   * to sharp, which avoids a throwaway intermediate encode.
   *
   * Text and thumbnails are produced in this same pass: the page is already
   * parsed and its pixels are already in memory, so both are far cheaper here
   * than they would be as a second walk over the document.
   */
  async render(pdf: Buffer, sink: PageSink): Promise<RenderResult> {
    const pdfjs = await esmImport('pdfjs-dist/legacy/build/pdf.mjs');

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdf),
      // No worker thread in Node; run everything on the main thread.
      disableWorker: true,
      disableFontFace: true,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const doc = await loadingTask.promise;
    const total: number = doc.numPages;
    const startedAt = Date.now();
    let searchable = false;
    let outline: OutlineEntry[] = [];

    try {
      outline = await this.readOutline(doc);

      for (let n = 1; n <= total; n++) {
        const page = await doc.getPage(n);
        try {
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(
            MAX_SCALE,
            Math.max(1, TARGET_WIDTH / base.width),
          );
          const viewport = page.getViewport({ scale });

          const width = Math.ceil(viewport.width);
          const height = Math.ceil(viewport.height);
          const canvas = createCanvas(width, height);
          const ctx = canvas.getContext('2d');

          // PDFs assume a white page; the canvas starts transparent.
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);

          await page.render({
            canvas: canvas as unknown as HTMLCanvasElement,
            canvasContext: ctx as unknown as CanvasRenderingContext2D,
            viewport,
          }).promise;

          const raw = sharp(
            Buffer.from(ctx.getImageData(0, 0, width, height).data.buffer),
            { raw: { width, height, channels: 4 } },
          );

          const [image, thumbnail] = await Promise.all([
            raw.clone().webp({ quality: MASTER_QUALITY }).toBuffer(),
            raw
              .clone()
              .resize({ width: THUMB_WIDTH })
              .webp({ quality: THUMB_QUALITY })
              .toBuffer(),
          ]);

          const text = await this.readText(page);
          if (text) searchable = true;

          await sink({ index: n, image, thumbnail, text, width, height }, total);
        } finally {
          page.cleanup();
        }

        // Rendering is CPU-bound and synchronous inside pdf.js; yield between
        // pages so the API keeps answering requests during a long upload.
        await new Promise((resolve) => setImmediate(resolve));
      }
    } finally {
      await loadingTask.destroy();
    }

    const ms = Date.now() - startedAt;
    this.logger.log(
      `Rendered ${total} page(s) in ${ms}ms (${Math.round(ms / total)}ms/page)` +
        `, ${searchable ? 'searchable' : 'no text layer'}` +
        `, ${outline.length} outline root(s)`,
    );
    return { total, outline, searchable };
  }

  /**
   * Flatten a page's text runs into one searchable string.
   *
   * Scanned guides have no text layer at all, which is not an error — it just
   * means this guide can't offer search.
   */
  private async readText(page: any): Promise<string> {
    try {
      const content = await page.getTextContent();
      const text = content.items
        .map((item: { str?: string }) => item.str ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text.slice(0, MAX_TEXT_PER_PAGE);
    } catch {
      return '';
    }
  }

  /**
   * Read the PDF's own bookmarks as a page-numbered tree.
   *
   * Destinations are stored as object references rather than page numbers, so
   * each one has to be resolved; entries that don't resolve are dropped rather
   * than shown as links that go nowhere.
   */
  private async readOutline(doc: any): Promise<OutlineEntry[]> {
    let raw: any[] | null = null;
    try {
      raw = await doc.getOutline();
    } catch {
      return [];
    }
    if (!Array.isArray(raw) || !raw.length) return [];

    const convert = async (items: any[], depth: number): Promise<OutlineEntry[]> => {
      // A malformed outline can nest very deeply; stop before it costs anything.
      if (depth > 6) return [];
      const out: OutlineEntry[] = [];
      for (const item of items) {
        const page = await this.destinationPage(doc, item?.dest);
        const children = Array.isArray(item?.items)
          ? await convert(item.items, depth + 1)
          : [];
        // Keep a titled parent whose own link is broken if it still leads
        // somewhere through its children.
        const resolved = page ?? children[0]?.page;
        const title = String(item?.title ?? '').trim().slice(0, 300);
        if (!title || !resolved) continue;
        out.push({ title, page: resolved, children });
      }
      return out;
    };

    try {
      return await convert(raw, 0);
    } catch {
      return [];
    }
  }

  private async destinationPage(doc: any, dest: any): Promise<number | null> {
    try {
      const resolved =
        typeof dest === 'string' ? await doc.getDestination(dest) : dest;
      if (!Array.isArray(resolved) || !resolved.length) return null;
      const index = await doc.getPageIndex(resolved[0]);
      return typeof index === 'number' ? index + 1 : null;
    } catch {
      return null;
    }
  }
}
