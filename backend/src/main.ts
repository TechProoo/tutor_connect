import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Strip unknown props, reject extras, and coerce payload types.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // The survey endpoints are public (anyone on any device submits responses)
  // and the admin GET routes are protected by the x-admin-key header, so CORS
  // is open — origin restrictions would add deploy friction without security.
  app.enableCors();

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
