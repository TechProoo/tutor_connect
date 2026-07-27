import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { IsString, MaxLength } from 'class-validator';
import { AccessService, RequestMeta } from './access.service';
import { GuidesService } from '../guides/guides.service';

class RedeemDto {
  @IsString()
  @MaxLength(64)
  code: string;
}

const DEVICE_COOKIE = 'tc_device';

/** Public, student-facing endpoints for courses.tutorconnect.ng. */
@Controller('access')
export class AccessController {
  constructor(
    private readonly access: AccessService,
    private readonly guides: GuidesService,
  ) {}

  /**
   * The device token is sent as a header (works everywhere, including when
   * third-party cookies are blocked) and mirrored into an HTTP-only cookie as
   * a recovery layer.
   */
  private token(req: Request): string | undefined {
    const header = req.header('x-device-token');
    if (header) return header;
    const cookie = (req as Request & { cookies?: Record<string, string> })
      .cookies?.[DEVICE_COOKIE];
    return cookie || undefined;
  }

  private meta(req: Request): RequestMeta {
    const forwarded = req.header('x-forwarded-for');
    return {
      ip: (forwarded ? forwarded.split(',')[0] : req.ip)?.trim(),
      ua: req.header('user-agent'),
    };
  }

  /** Catalogue shown on the landing screen (titles only, no content). */
  @Get('catalog')
  catalog() {
    return this.guides.listPublic();
  }

  @Post('redeem')
  async redeem(
    @Body() dto: RedeemDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.access.redeem(
      dto.code,
      this.meta(req),
      this.token(req),
    );

    if ('deviceToken' in result && result.deviceToken) {
      res.cookie(DEVICE_COOKIE, result.deviceToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 5 * 365 * 24 * 60 * 60 * 1000,
      });
    }
    return result;
  }

  @Get('session')
  session(@Req() req: Request) {
    return this.access.session(this.token(req));
  }

  @Get('page/:n')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Content-Type', 'image/jpeg')
  @Header('X-Content-Type-Options', 'nosniff')
  async page(
    @Param('n', ParseIntPipe) n: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const jpeg = await this.access.page(this.token(req), n);
    res.setHeader('Content-Length', jpeg.length);
    res.end(jpeg);
  }
}
