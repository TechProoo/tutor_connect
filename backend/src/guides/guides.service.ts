import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GuideStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PdfRenderService } from './pdf-render.service';
import { CreateGuideDto, UpdateGuideDto } from './dto/guide.dto';

const PDF_MAGIC = '%PDF';

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

      const total = await this.renderer.render(pdf, async (page, pageTotal) => {
        await this.storage.put(
          `${pagePrefix}/${String(page.index).padStart(4, '0')}.jpg`,
          page.jpeg,
          'image/jpeg',
        );

        // On a first upload there is nothing else to read, so release pages as
        // they land — a student can start on page 1 while the rest renders.
        // The database is in another region, so publish the first page
        // immediately and then batch the rest rather than writing per page.
        const shouldPublish =
          !isReplacement &&
          (page.index === 1 || Date.now() - lastPublishedAt > 3000);
        if (shouldPublish) {
          lastPublishedAt = Date.now();
          await this.prisma.guide
            .update({
              where: { id },
              data: { pagePrefix, pageCount: page.index, version },
            })
            .catch(() => undefined);
        }
        if (page.index === 1 || page.index % 10 === 0 || page.index === pageTotal) {
          this.logger.log(`Guide ${id}: ${page.index}/${pageTotal} pages ready`);
        }
      });

      if (!total) throw new Error('The PDF contains no pages');

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
