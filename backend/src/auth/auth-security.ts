import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

export const officerSessionCookie = 'janaseva_session';

export function getCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return undefined;
}

export function getSessionCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
  };
}

@Injectable()
export class AuthOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return true;
    }

    const expectedOrigin = this.config.get<string>('FRONTEND_ORIGIN');
    if (!expectedOrigin && process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'Request origin validation is not configured.',
      );
    }
    const allowedOrigin = expectedOrigin ?? 'http://localhost:3001';
    const origin = request.headers.origin;
    if (!origin || origin !== allowedOrigin) {
      throw new ForbiddenException('Request origin is not allowed.');
    }
    return true;
  }
}
