import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CodeStatus, EmailStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { generateCode, hashCode, lastFour, normalizeCode } from './code.util';
import { CreateCodeDto, ListCodesQuery, UpdateBuyerDto } from './dto/code.dto';

/** Fields safe to return to the admin UI (never the code hash). */
const publicSelect = {
  id: true,
  codeLast4: true,
  guideId: true,
  buyerName: true,
  buyerPhone: true,
  buyerEmail: true,
  status: true,
  deviceLabel: true,
  deviceUa: true,
  deviceIp: true,
  redeemedAt: true,
  lastAccessAt: true,
  accessCount: true,
  resetCount: true,
  emailStatus: true,
  emailError: true,
  emailSentAt: true,
  createdAt: true,
  guide: { select: { id: true, title: true, courseCode: true } },
} satisfies Prisma.AccessCodeSelect;

@Injectable()
export class CodesService {
  private readonly logger = new Logger(CodesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async list(query: ListCodesQuery) {
    const q = query.q?.trim();
    const where: Prisma.AccessCodeWhereInput = {
      ...(query.status ? { status: query.status as CodeStatus } : {}),
      ...(query.guideId ? { guideId: query.guideId } : {}),
      ...(q
        ? {
            OR: [
              { buyerPhone: { contains: q, mode: 'insensitive' } },
              { buyerEmail: { contains: q, mode: 'insensitive' } },
              { buyerName: { contains: q, mode: 'insensitive' } },
              // Searching by a full code: match its hash.
              { codeHash: hashCode(q) },
              { codeLast4: normalizeCode(q).slice(-4) },
            ],
          }
        : {}),
    };

    return this.prisma.accessCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: publicSelect,
    });
  }

  async stats() {
    const [unused, redeemed, disabled, revoked, guides] = await Promise.all([
      this.prisma.accessCode.count({ where: { status: CodeStatus.UNUSED } }),
      this.prisma.accessCode.count({ where: { status: CodeStatus.REDEEMED } }),
      this.prisma.accessCode.count({ where: { status: CodeStatus.DISABLED } }),
      this.prisma.accessCode.count({ where: { status: CodeStatus.REVOKED } }),
      this.prisma.guide.count(),
    ]);
    return {
      unused,
      redeemed,
      disabled,
      revoked,
      total: unused + redeemed + disabled + revoked,
      guides,
    };
  }

  /**
   * Create a one-time code and email it. The plaintext is returned exactly
   * once — only its hash is persisted.
   */
  async create(dto: CreateCodeDto) {
    const guide = await this.prisma.guide.findUnique({
      where: { id: dto.guideId },
    });
    if (!guide) throw new NotFoundException('Guide not found');

    const code = await this.insertUniqueCode(dto);
    const sent = await this.deliver(code.record.id, {
      to: dto.buyerEmail,
      buyerName: dto.buyerName,
      guideTitle: guide.title,
      courseCode: guide.courseCode,
      code: code.plain,
    });

    return { ...code.record, code: code.plain, emailStatus: sent };
  }

  private async insertUniqueCode(dto: CreateCodeDto) {
    // Collisions are astronomically unlikely, but retry rather than 500.
    for (let attempt = 0; attempt < 5; attempt++) {
      const plain = generateCode();
      try {
        const record = await this.prisma.accessCode.create({
          data: {
            codeHash: hashCode(plain),
            codeLast4: lastFour(plain),
            guideId: dto.guideId,
            buyerName: dto.buyerName.trim(),
            buyerPhone: dto.buyerPhone.trim(),
            buyerEmail: dto.buyerEmail.trim().toLowerCase(),
          },
          select: publicSelect,
        });
        return { plain, record };
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          continue;
        }
        throw e;
      }
    }
    throw new BadRequestException('Could not allocate a unique code, try again');
  }

  private async deliver(
    id: string,
    payload: Parameters<MailService['sendAccessCode']>[0],
  ) {
    const result = await this.mail.sendAccessCode(payload);
    await this.prisma.accessCode.update({
      where: { id },
      data: {
        emailStatus: result.status as EmailStatus,
        emailError: 'error' in result ? result.error : null,
        emailSentAt: result.status === 'SENT' ? new Date() : null,
      },
    });
    return result.status;
  }

  private async find(id: string) {
    const code = await this.prisma.accessCode.findUnique({
      where: { id },
      include: { guide: true },
    });
    if (!code) throw new NotFoundException('Access code not found');
    return code;
  }

  /** Correct buyer details before redemption (e.g. a mistyped email). */
  async updateBuyer(id: string, dto: UpdateBuyerDto) {
    await this.find(id);
    return this.prisma.accessCode.update({
      where: { id },
      data: {
        buyerName: dto.buyerName?.trim(),
        buyerPhone: dto.buyerPhone?.trim(),
        buyerEmail: dto.buyerEmail?.trim().toLowerCase(),
      },
      select: publicSelect,
    });
  }

  /** Stop an unused code from ever being redeemed. */
  async disable(id: string) {
    const code = await this.find(id);
    if (code.status === CodeStatus.REDEEMED) {
      throw new BadRequestException(
        'This code is already redeemed — use revoke to remove access.',
      );
    }
    return this.prisma.accessCode.update({
      where: { id },
      data: { status: CodeStatus.DISABLED },
      select: publicSelect,
    });
  }

  /** Cut off a redeemed buyer immediately. */
  async revoke(id: string) {
    await this.find(id);
    return this.prisma.accessCode.update({
      where: { id },
      data: { status: CodeStatus.REVOKED },
      select: publicSelect,
    });
  }

  /** Put a disabled/revoked code back into circulation. */
  async restore(id: string) {
    const code = await this.find(id);
    return this.prisma.accessCode.update({
      where: { id },
      data: {
        status: code.deviceTokenHash ? CodeStatus.REDEEMED : CodeStatus.UNUSED,
      },
      select: publicSelect,
    });
  }

  /**
   * Release the browser binding so the buyer can redeem the same code once
   * more — used after verifying a recovery request.
   */
  async resetDevice(id: string) {
    const code = await this.find(id);
    if (!code.deviceTokenHash) {
      throw new BadRequestException('This code is not bound to a device yet.');
    }
    return this.prisma.accessCode.update({
      where: { id },
      data: {
        status: CodeStatus.UNUSED,
        deviceTokenHash: null,
        deviceLabel: null,
        deviceUa: null,
        deviceIp: null,
        redeemedAt: null,
        resetCount: { increment: 1 },
      },
      select: publicSelect,
    });
  }

  /**
   * Invalidate an unused code and email a fresh one. Never re-sends the
   * original, so a leaked email can't be replayed.
   */
  async regenerate(id: string) {
    const code = await this.find(id);
    if (code.status === CodeStatus.REDEEMED) {
      throw new BadRequestException(
        'This code is already redeemed — reset the device instead.',
      );
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const plain = generateCode();
      try {
        const record = await this.prisma.accessCode.update({
          where: { id },
          data: {
            codeHash: hashCode(plain),
            codeLast4: lastFour(plain),
            status: CodeStatus.UNUSED,
            emailStatus: EmailStatus.PENDING,
            emailError: null,
            emailSentAt: null,
          },
          select: publicSelect,
        });
        const sent = await this.deliver(id, {
          to: code.buyerEmail,
          buyerName: code.buyerName,
          guideTitle: code.guide.title,
          courseCode: code.guide.courseCode,
          code: plain,
        });
        return { ...record, code: plain, emailStatus: sent };
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          continue;
        }
        throw e;
      }
    }
    throw new BadRequestException('Could not allocate a unique code, try again');
  }

  async remove(id: string) {
    await this.find(id);
    await this.prisma.accessCode.delete({ where: { id } });
    return { deleted: true };
  }

  /** Recent failed redemption attempts, for the admin activity view. */
  recentAttempts() {
    return this.prisma.accessAttempt.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
