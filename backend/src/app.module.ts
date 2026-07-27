import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SurveyModule } from './survey/survey.module';
import { StorageModule } from './storage/storage.module';
import { MailModule } from './mail/mail.module';
import { GuidesModule } from './guides/guides.module';
import { CodesModule } from './codes/codes.module';
import { AccessModule } from './access/access.module';
import { RecoveryModule } from './recovery/recovery.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    MailModule,
    SurveyModule,
    GuidesModule,
    CodesModule,
    AccessModule,
    RecoveryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
