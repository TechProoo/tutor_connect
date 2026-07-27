import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminKeyGuard } from '../survey/admin-key.guard';
import { GuidesService } from './guides.service';
import { CreateGuideDto, UpdateGuideDto } from './dto/guide.dto';

/** Admin-only guide management. */
@Controller('guides')
@UseGuards(AdminKeyGuard)
export class GuidesController {
  constructor(private readonly guides: GuidesService) {}

  @Get()
  list() {
    return this.guides.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.guides.get(id);
  }

  @Post()
  create(@Body() dto: CreateGuideDto) {
    return this.guides.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGuideDto) {
    return this.guides.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.guides.remove(id);
  }

  @Post(':id/file')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 60 * 1024 * 1024 } }),
  )
  upload(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.guides.upload(id, file);
  }
}
