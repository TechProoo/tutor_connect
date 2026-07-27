import { Module } from '@nestjs/common';
import { GuidesController } from './guides.controller';
import { GuidesService } from './guides.service';
import { PdfRenderService } from './pdf-render.service';

@Module({
  controllers: [GuidesController],
  providers: [GuidesService, PdfRenderService],
  exports: [GuidesService],
})
export class GuidesModule {}
