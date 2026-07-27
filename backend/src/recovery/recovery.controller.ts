import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RecoveryStatus } from '@prisma/client';
import { AdminKeyGuard } from '../survey/admin-key.guard';
import { RecoveryService } from './recovery.service';
import { CreateRecoveryDto, ResolveRecoveryDto } from './dto/recovery.dto';

/** Public: students submit an access-recovery request. */
@Controller('recovery')
export class RecoveryPublicController {
  constructor(private readonly recovery: RecoveryService) {}

  @Post()
  create(@Body() dto: CreateRecoveryDto) {
    return this.recovery.create(dto);
  }
}

/** Admin: review and resolve recovery requests. */
@Controller('admin/recovery')
@UseGuards(AdminKeyGuard)
export class RecoveryAdminController {
  constructor(private readonly recovery: RecoveryService) {}

  @Get()
  list(@Query('status') status?: RecoveryStatus) {
    return this.recovery.list(status);
  }

  @Get(':id/matches')
  matches(@Param('id') id: string) {
    return this.recovery.matches(id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ResolveRecoveryDto) {
    return this.recovery.resolve(id, RecoveryStatus.APPROVED, dto);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: ResolveRecoveryDto) {
    return this.recovery.resolve(id, RecoveryStatus.REJECTED, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.recovery.remove(id);
  }
}
