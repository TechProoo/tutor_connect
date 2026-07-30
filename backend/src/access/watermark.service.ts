import { Injectable } from '@nestjs/common';
import type { Sharp, SharpOptions } from 'sharp';

// sharp publishes ESM type declarations (`export default`) but resolves to a
// CommonJS function at runtime, so require() keeps both sides correct.
const sharp: (input?: Buffer | string, options?: SharpOptions) => Sharp =
  require('sharp');

export interface Watermark {
  buyerName: string;
  buyerPhone: string;
}

/**
 * How many pages may be watermarked at once.
 *
 * Watermarking is the most memory-hungry thing this service does. A page master
 * is a couple of hundred KB, but stamping it decodes the page to a full raster,
 * rasterises an overlay the same size again, then composites and re-encodes —
 * measured at roughly 90MB of resident memory for one page at the current
 * render width.
 *
 * That cost is per request, and the reader prefetches several pages around the
 * one being read, so a couple of students scrolling at once is enough to walk a
 * 512MB instance into its limit and get it restarted. Queueing past this point
 * makes a burst of traffic slightly slower to serve instead of fatal, and keeps
 * peak memory a property of the code rather than of how many people showed up.
 */
const MAX_CONCURRENT_WATERMARKS = Math.max(
  1,
  Number(process.env.WATERMARK_CONCURRENCY) || 2,
);

/** Minimal counting semaphore: admits N holders, queues the rest in order. */
class Semaphore {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      // Hand the slot straight to the next waiter rather than reopening it to
      // whoever asks first, so a queued request can't be starved.
      this.waiting.shift()?.();
    }
  }
}

/**
 * Burns a per-buyer watermark into a page image at request time.
 *
 * The mark is tiled diagonally across the whole page rather than sitting in a
 * footer, so a leaked screenshot can't simply be cropped to remove it.
 */
@Injectable()
export class WatermarkService {
  private readonly gate = new Semaphore(MAX_CONCURRENT_WATERMARKS);

  apply(pageJpeg: Buffer, mark: Watermark): Promise<Buffer> {
    return this.gate.run(() => this.stamp(pageJpeg, mark));
  }

  private async stamp(pageJpeg: Buffer, mark: Watermark): Promise<Buffer> {
    const img = sharp(pageJpeg);
    const { width = 1400, height = 1980 } = await img.metadata();

    const svg = Buffer.from(this.overlaySvg(width, height, mark));

    return (
      img
        .composite([{ input: svg, top: 0, left: 0 }])
        // Delivered as WebP whatever the master was: on a real guide page this
        // is both smaller and quicker than the JPEG it replaced, and it drops
        // the ringing JPEG leaves around text. `effort` is deliberately low —
        // this runs per request, and the levels above it cost several times the
        // time to save a few KB.
        .webp({ quality: 84, effort: 2 })
        .toBuffer()
    );
  }

  private overlaySvg(width: number, height: number, mark: Watermark): string {
    // Scale the mark with the page so it looks the same on any page size.
    const size = Math.max(15, Math.round(width / 68));
    const tileW = Math.round(width * 0.62);
    const tileH = Math.round(width * 0.42);
    const name = esc(mark.buyerName);
    const phone = esc(mark.buyerPhone);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <pattern id="wm" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse" patternTransform="rotate(-32)">
      <text x="0" y="${size * 1.4}" font-family="Helvetica, Arial, DejaVu Sans, sans-serif"
            font-size="${size}" font-weight="700" fill="#1a3a5c" fill-opacity="0.13"
            letter-spacing="0.5">Purchased through Tutor Connect</text>
      <text x="0" y="${size * 2.9}" font-family="Helvetica, Arial, DejaVu Sans, sans-serif"
            font-size="${size}" font-weight="600" fill="#1a3a5c" fill-opacity="0.13">Purchased by: ${name}</text>
      <text x="0" y="${size * 4.4}" font-family="Helvetica, Arial, DejaVu Sans, sans-serif"
            font-size="${size}" font-weight="600" fill="#f47b20" fill-opacity="0.15">Phone: ${phone}</text>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#wm)" />
</svg>`;
  }
}

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
}
