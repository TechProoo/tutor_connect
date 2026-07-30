import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GuideStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  PAGE_CONTENT_TYPE,
  PAGE_EXTENSION,
  PdfRenderService,
  type OutlineEntry,
} from './pdf-render.service';
import { CreateGuideDto, UpdateGuideDto } from './dto/guide.dto';

const PDF_MAGIC = '%PDF';

/**
 * Search text and table of contents for one rendered version, stored beside its
 * pages. Keeping this in storage rather than the database means adding search
 * needed no migration, and it is read as a unit anyway.
 */
export interface GuideIndex {
  outline: OutlineEntry[];
  searchable: boolean;
  /** Page number (as a string key) to that page's flattened text. */
  pages: Record<string, string>;
}

/** Name of the index object within a version's folder. */
export const INDEX_FILE = 'index.json';

/** Subfolder holding page-navigator previews. */
export const THUMB_FOLDER = 'thumbs';

@Injectable()
export class GuidesService {
  private readonly logger = new Logger(GuidesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly renderer: PdfRenderService,
  ) {}

  list() {
    return this.prisma.guide.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { codes: true } } },
    });
  }

  /** Published + rendered guides, for the student-facing portal. */
  listPublic() {
    return this.prisma.guide.findMany({
      where: { published: true, status: GuideStatus.READY },
      orderBy: { courseCode: 'asc' },
      select: {
        id: true,
        title: true,
        courseCode: true,
        subject: true,
        description: true,
        pageCount: true,
      },
    });
  }

  async get(id: string) {
    const guide = await this.prisma.guide.findUnique({ where: { id } });
    if (!guide) throw new NotFoundException('Guide not found');
    return guide;
  }

  create(dto: CreateGuideDto) {
    return this.prisma.guide.create({
      data: {
        title: dto.title,
        courseCode: dto.courseCode.toUpperCase(),
        subject: dto.subject,
        description: dto.description,
      },
    });
  }

  async update(id: string, dto: UpdateGuideDto) {
    const guide = await this.get(id);
    if (dto.published && guide.status !== GuideStatus.READY) {
      throw new BadRequestException(
        'Upload a PDF and wait for processing to finish before publishing.',
      );
    }
    return this.prisma.guide.update({
      where: { id },
      data: {
        ...dto,
        courseCode: dto.courseCode ? dto.courseCode.toUpperCase() : undefined,
      },
    });
  }

  async remove(id: string) {
    const guide = await this.get(id);
    await this.storage.removePrefix(`guides/${guide.id}`).catch(() => undefined);
    await this.prisma.guide.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Store a new PDF for a guide and (re)render its pages. Replacing the file
   * bumps the version so existing buyers automatically read the newest edition.
   */
  async upload(id: string, file: Express.Multer.File) {
    const guide = await this.get(id);
    if (!file?.buffer?.length) throw new BadRequestException('No file uploaded');
    if (file.buffer.subarray(0, 4).toString('latin1') !== PDF_MAGIC) {
      throw new BadRequestException('Only PDF files are supported');
    }

    // First upload keeps version 1; every replacement bumps it.
    const isReplacement = Boolean(guide.sourceKey);
    const version = isReplacement ? guide.version + 1 : guide.version;
    const base = `guides/${guide.id}/v${version}`;
    const sourceKey = `${base}/source.pdf`;

    await this.storage.put(sourceKey, file.buffer, 'application/pdf');

    // Only the status moves now. A replacement keeps serving the previous
    // version (pagePrefix, pageCount and published are untouched) until the new
    // one is fully rendered, so buyers never hit a half-built guide.
    const updated = await this.prisma.guide.update({
      where: { id },
      data: { sourceKey, status: GuideStatus.PROCESSING, error: null },
    });

    // Rasterising is slow; run it after the response so the upload returns fast.
    void this.process(id, file.buffer, base, guide.version, version, isReplacement);

    return updated;
  }

  private async process(
    id: string,
    pdf: Buffer,
    base: string,
    previousVersion: number,
    version: number,
    isReplacement: boolean,
  ) {
    const pagePrefix = `${base}/pages`;
    try {
      let lastPublishedAt = 0;
      const text: Record<string, string> = {};

      // Pages finish out of order now that they are stored concurrently, so
      // track which have actually landed. Only the unbroken run from page 1 is
      // safe to advertise — a reader told it has 5 pages must not be able to
      // request a page that is still uploading.
      const landed = new Set<number>();
      let contiguous = 0;

      const { total, outline, searchable } = await this.renderer.render(
        pdf,
        async (page, pageTotal) => {
          const name = String(page.index).padStart(4, '0');
          if (page.text) text[String(page.index)] = page.text;

          await Promise.all([
            this.storage.put(
              `${pagePrefix}/${name}.${PAGE_EXTENSION}`,
              page.image,
              PAGE_CONTENT_TYPE,
            ),
            this.storage.put(
              `${base}/${THUMB_FOLDER}/${name}.${PAGE_EXTENSION}`,
              page.thumbnail,
              PAGE_CONTENT_TYPE,
            ),
          ]);

          landed.add(page.index);
          while (landed.has(contiguous + 1)) contiguous++;

          // On a first upload there is nothing else to read, so release pages as
          // they land — a student can start on page 1 while the rest renders.
          // The database is in another region, so publish the first page
          // immediately and then batch the rest rather than writing per page.
          const shouldPublish =
            !isReplacement &&
            contiguous > 0 &&
            (contiguous === 1 || Date.now() - lastPublishedAt > 3000);
          if (shouldPublish) {
            lastPublishedAt = Date.now();
            await this.prisma.guide
              .update({
                where: { id },
                data: { pagePrefix, pageCount: contiguous, version },
              })
              .catch(() => undefined);
          }
          if (
            contiguous === 1 ||
            contiguous % 25 === 0 ||
            contiguous === pageTotal
          ) {
            this.logger.log(`Guide ${id}: ${contiguous}/${pageTotal} pages ready`);
          }
        },
      );

      if (!total) throw new Error('The PDF contains no pages');

      // Search and contents only become available once the whole document has
      // been read, so this lands in one write at the end.
      const index: GuideIndex = { outline, searchable, pages: text };
      await this.storage.put(
        `${base}/${INDEX_FILE}`,
        Buffer.from(JSON.stringify(index)),
        'application/json',
      );

      // Swap to the finished version in one write.
      await this.prisma.guide.update({
        where: { id },
        data: {
          status: GuideStatus.READY,
          pagePrefix,
          pageCount: total,
          version,
          error: null,
        },
      });

      // Old version's images are now dead weight.
      if (version !== previousVersion) {
        await this.storage
          .removePrefix(`guides/${id}/v${previousVersion}`)
          .catch(() => undefined);
      }

      this.logger.log(`Guide ${id} ready — ${total} pages (v${version})`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`Guide ${id} failed to render: ${message}`);
      await this.prisma.guide
        .update({
          where: { id },
          data: { status: GuideStatus.FAILED, error: message },
        })
        .catch(() => undefined);
    }
  }
}
