import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');

/**
 * Keep libvips lean.
 *
 * Image work here is one-shot — a page is decoded, stamped and encoded once —
 * so libvips's operation cache only holds memory that will never be reused. Its
 * thread pool is sized from the CPU count and gives every thread its own
 * working buffers, which on a small single-core instance multiplies peak memory
 * for no throughput. Both are set before anything touches sharp.
 */
function configureImageProcessing() {
  sharp.cache(false);
  sharp.concurrency(1);
}

/**
 * Browser origins allowed to call this API.
 *
 * Note these carry no trailing slash: the browser's `Origin` header is only ever
 * scheme + host + port, so "https://tutorconnect.ng/" would never match.
 */
const ALLOWED_ORIGINS = [
  'https://tutorconnect.ng',
  'https://www.tutorconnect.ng',
  'https://admin.tutorconnect.ng',
  'https://courses.tutorconnect.ng',
  // Anything else, e.g. a Netlify deploy preview, without a code change.
  ...(process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
];

/** Vite dev servers pick their own port, so allow any local one off production. */
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

async function bootstrap() {
  configureImageProcessing();

  const app = await NestFactory.create(AppModule);

  // Trust Railway's proxy so req.ip reflects the real client address.
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
  // protected by the x-admin-key header. Origins are matched against a list
  // rather than reflected: the device cookie is sent cross-site, so reflecting
  // whatever origin asked would let any page on the web drive a student's
  // session using their own cookie.
  app.enableCors({
    origin: (origin, callback) => {
      // Requests with no Origin are not from a browser — curl, health checks,
      // server-to-server — and are not what CORS is protecting against.
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' && LOCAL_ORIGIN.test(origin)) {
        return callback(null, true);
      }
      // Refuse by withholding the CORS headers, which is what the browser reads.
      // Passing an error here would answer with a 500 instead.
      return callback(null, false);
    },
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
