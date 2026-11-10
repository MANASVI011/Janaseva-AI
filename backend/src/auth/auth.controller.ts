import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  CurrentOfficer,
  OfficerJwtGuard,
  type OfficerIdentity,
} from './officer-auth.js';
import { AuthService } from './auth.service.js';
import {
  getCookieValue,
  getSessionCookieOptions,
  officerSessionCookie,
} from './auth-security.js';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const credentials =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : {};
    const session = await this.auth.login(
      credentials.username,
      credentials.password,
      request.ip ?? 'unknown',
    );
    response.cookie(
      officerSessionCookie,
      session.token,
      this.cookieOptions(session.expiresAt),
    );
    return { officer: session.officer, expiresAt: session.expiresAt };
  }

  @Get('session')
  @UseGuards(OfficerJwtGuard)
  session(@CurrentOfficer() officer: OfficerIdentity, @Req() request: Request) {
    const expiresAt = (request as Request & { officerExpiresAt?: Date })
      .officerExpiresAt;
    if (!expiresAt && process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('The officer session is invalid.');
    }
    return { officer, expiresAt: expiresAt ?? null };
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.revokeSession(
      getCookieValue(request, officerSessionCookie) ??
        request.headers.authorization?.replace(/^Bearer\s+/i, ''),
    );
    response.clearCookie(
      officerSessionCookie,
      getSessionCookieOptions(this.isProduction()),
    );
    return { success: true };
  }

  private cookieOptions(expiresAt: Date) {
    return {
      ...getSessionCookieOptions(this.isProduction()),
      expires: expiresAt,
    };
  }

  private isProduction() {
    return (
      (this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV) ===
      'production'
    );
  }
}
