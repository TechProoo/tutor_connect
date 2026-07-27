import { Injectable, Logger } from '@nestjs/common';
import { createCanvas } from '@napi-rs/canvas';

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
  jpeg: Buffer;
  width: number;
  height: number;
}

/** Called as each page finishes, so callers can publish pages progressively. */
export type PageSink = (page: RenderedPage, total: number) => Promise<void>;

/**
 * Width, in CSS pixels, that pages are rasterised to. Comfortably sharp on a
 * high-DPI phone while keeping files small — page weight is what students on
 * mobile data actually feel.
 */
const TARGET_WIDTH = 1240;
const JPEG_QUALITY = 0.82;

@Injectable()
export class PdfRenderService {
  private readonly logger = new Logger(PdfRenderService.name);

  /**
   * Rasterise every page of a PDF to a JPEG buffer, invoking `sink` after each
   * one so pages can be stored and served before the whole document is done.
   *
   * The canvas encodes JPEG directly: going via PNG and re-encoding through
   * sharp costs roughly 3.5x the time and produces ~5x larger files.
   */
  async render(pdf: Buffer, sink: PageSink): Promise<number> {
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

    try {
      for (let n = 1; n <= total; n++) {
        const page = await doc.getPage(n);
        try {
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(3, Math.max(1, TARGET_WIDTH / base.width));
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

          const jpeg = canvas.toBuffer('image/jpeg', JPEG_QUALITY);
          await sink({ index: n, jpeg, width, height }, total);
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
      `Rendered ${total} page(s) in ${ms}ms (${Math.round(ms / total)}ms/page)`,
    );
    return total;
  }
}
