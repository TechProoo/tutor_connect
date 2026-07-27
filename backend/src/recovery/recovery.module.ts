import { Module } from '@nestjs/common';
import {
  RecoveryAdminController,
  RecoveryPublicController,
} from './recovery.controller';
import { RecoveryService } from './recovery.service';

@Module({
  controllers: [RecoveryPublicController, RecoveryAdminController],
  providers: [RecoveryService],
})
export class RecoveryModule {}
