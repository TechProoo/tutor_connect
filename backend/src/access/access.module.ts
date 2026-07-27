import { Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { WatermarkService } from './watermark.service';
import { GuidesModule } from '../guides/guides.module';

@Module({
  imports: [GuidesModule],
  controllers: [AccessController],
  providers: [AccessService, WatermarkService],
})
export class AccessModule {}
