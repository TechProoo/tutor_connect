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
    const version = guide.sourceKey ? guide.version + 1 : guide.version;
    const base = `guides/${guide.id}/v${version}`;
    const sourceKey = `${base}/source.pdf`;

    await this.storage.put(sourceKey, file.buffer, 'application/pdf');

    const updated = await this.prisma.guide.update({
      where: { id },
      data: {
        version,
        sourceKey,
        pagePrefix: `${base}/pages`,
        status: GuideStatus.PROCESSING,
        pageCount: 0,
        error: null,
        // A guide being re-rendered must not stay readable mid-flight.
        published: false,
      },
    });

    // Rasterising is slow; run it after the response so the upload returns fast.
    void this.process(id, file.buffer, `${base}/pages`, guide.version, version);

    return updated;
  }

  private async process(
    id: string,
    pdf: Buffer,
    pagePrefix: string,
    previousVersion: number,
    version: number,
  ) {
    try {
      const pages = await this.renderer.render(pdf);
      if (!pages.length) throw new Error('The PDF contains no pages');

      await Promise.all(
        pages.map((p) =>
          this.storage.put(
            `${pagePrefix}/${String(p.index).padStart(4, '0')}.jpg`,
            p.jpeg,
            'image/jpeg',
          ),
        ),
      );

      await this.prisma.guide.update({
        where: { id },
        data: {
          status: GuideStatus.READY,
          pageCount: pages.length,
          error: null,
        },
      });

      // Old version's images are now dead weight.
      if (version !== previousVersion) {
        await this.storage
          .removePrefix(`guides/${id}/v${previousVersion}`)
          .catch(() => undefined);
      }

      this.logger.log(`Guide ${id} ready — ${pages.length} pages (v${version})`);
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
