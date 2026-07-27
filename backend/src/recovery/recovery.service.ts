import { Injectable, NotFoundException } from '@nestjs/common';
import { RecoveryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecoveryDto, ResolveRecoveryDto } from './dto/recovery.dto';

@Injectable()
export class RecoveryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Student-submitted "I lost access" request. */
  async create(dto: CreateRecoveryDto) {
    const request = await this.prisma.recoveryRequest.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        email: dto.email.trim().toLowerCase(),
        codeHint: dto.codeHint?.trim(),
        guideId: dto.guideId,
        reason: dto.reason?.trim(),
      },
    });
    // Only confirm receipt — never leak whether the details matched a purchase.
    return { id: request.id, status: request.status };
  }

  list(status?: RecoveryStatus) {
    return this.prisma.recoveryRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { guide: { select: { id: true, title: true, courseCode: true } } },
    });
  }

  /**
   * Matching purchases for a request, so the admin can verify the buyer
   * before releasing a device binding.
   */
  async matches(id: string) {
    const request = await this.prisma.recoveryRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException('Request not found');

    return this.prisma.accessCode.findMany({
      where: {
        OR: [
          { buyerPhone: { contains: request.phone, mode: 'insensitive' } },
          { buyerEmail: { equals: request.email, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        codeLast4: true,
        buyerName: true,
        buyerPhone: true,
        buyerEmail: true,
        status: true,
        deviceLabel: true,
        redeemedAt: true,
        resetCount: true,
        guide: { select: { id: true, title: true, courseCode: true } },
      },
    });
  }

  async resolve(id: string, status: RecoveryStatus, dto: ResolveRecoveryDto) {
    const request = await this.prisma.recoveryRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException('Request not found');

    return this.prisma.recoveryRequest.update({
      where: { id },
      data: { status, adminNote: dto.adminNote?.trim(), resolvedAt: new Date() },
    });
  }

  async remove(id: string) {
    await this.prisma.recoveryRequest.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Request not found');
    });
    return { deleted: true };
  }
}
