import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust Render's proxy so req.ip reflects the real client address.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(cookieParser());

  // Strip unknown props, reject extras, and coerce payload types.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Survey submission and code redemption are public, and the admin routes are
  // protected by the x-admin-key header. Origins are reflected rather than
  // wildcarded so the device cookie can travel with credentialed requests.
  app.enableCors({ origin: true, credentials: true });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
