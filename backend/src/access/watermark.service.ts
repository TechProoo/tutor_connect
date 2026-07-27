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
 * Burns a per-buyer watermark into a page image at request time.
 *
 * The mark is tiled diagonally across the whole page rather than sitting in a
 * footer, so a leaked screenshot can't simply be cropped to remove it.
 */
@Injectable()
export class WatermarkService {
  async apply(pageJpeg: Buffer, mark: Watermark): Promise<Buffer> {
    const img = sharp(pageJpeg);
    const { width = 1400, height = 1980 } = await img.metadata();

    const svg = Buffer.from(this.overlaySvg(width, height, mark));

    return img
      .composite([{ input: svg, top: 0, left: 0 }])
      .jpeg({ quality: 82, progressive: true })
      .toBuffer();
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
