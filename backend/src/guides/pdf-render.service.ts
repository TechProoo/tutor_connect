import { Injectable, Logger } from '@nestjs/common';
import { createCanvas } from '@napi-rs/canvas';
import type { Sharp, SharpOptions } from 'sharp';

// sharp publishes ESM type declarations (`export default`) but resolves to a
// CommonJS function at runtime, so require() keeps both sides correct.
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
  jpeg: Buffer;
  width: number;
  height: number;
}

@Injectable()
export class PdfRenderService {
  private readonly logger = new Logger(PdfRenderService.name);

  /**
   * Rasterise every page of a PDF to a JPEG buffer.
   *
   * Pages are rendered at `targetWidth` CSS pixels wide (capped by the PDF's
   * own aspect) which is plenty for phone reading while keeping files small.
   */
  async render(pdf: Buffer, targetWidth = 1400): Promise<RenderedPage[]> {
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

    const pages: RenderedPage[] = [];
    try {
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        try {
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(3, Math.max(1, targetWidth / base.width));
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

          const jpeg = await sharp(canvas.toBuffer('image/png'))
            .jpeg({ quality: 82, progressive: true })
            .toBuffer();

          pages.push({ index: n, jpeg, width, height });
        } finally {
          page.cleanup();
        }
      }
    } finally {
      await loadingTask.destroy();
    }

    this.logger.log(`Rendered ${pages.length} page(s)`);
    return pages;
  }
}
