import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Protects the read (GET) endpoints with a shared admin key sent as the
 * `x-admin-key` header. If ADMIN_KEY is not configured (local dev), access
 * is allowed so the admin dashboard works out of the box.
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('ADMIN_KEY');
    if (!expected) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.header('x-admin-key');
    if (provided !== expected) {
      throw new UnauthorizedException('Invalid or missing admin key');
    }
    return true;
  }
}
