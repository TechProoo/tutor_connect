import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminKeyGuard } from '../survey/admin-key.guard';
import { CodesService } from './codes.service';
import { CreateCodeDto, ListCodesQuery, UpdateBuyerDto } from './dto/code.dto';

/** Admin-only access-code management. */
@Controller('codes')
@UseGuards(AdminKeyGuard)
export class CodesController {
  constructor(private readonly codes: CodesService) {}

  @Get()
  list(@Query() query: ListCodesQuery) {
    return this.codes.list(query);
  }

  @Get('stats')
  stats() {
    return this.codes.stats();
  }

  @Get('attempts')
  attempts() {
    return this.codes.recentAttempts();
  }

  @Post()
  create(@Body() dto: CreateCodeDto) {
    return this.codes.create(dto);
  }

  @Patch(':id/buyer')
  updateBuyer(@Param('id') id: string, @Body() dto: UpdateBuyerDto) {
    return this.codes.updateBuyer(id, dto);
  }

  @Post(':id/disable')
  disable(@Param('id') id: string) {
    return this.codes.disable(id);
  }

  @Post(':id/revoke')
  revoke(@Param('id') id: string) {
    return this.codes.revoke(id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.codes.restore(id);
  }

  @Post(':id/reset-device')
  resetDevice(@Param('id') id: string) {
    return this.codes.resetDevice(id);
  }

  @Post(':id/regenerate')
  regenerate(@Param('id') id: string) {
    return this.codes.regenerate(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.codes.remove(id);
  }
}
