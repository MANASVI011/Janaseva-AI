import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { OfficerRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type OfficerIdentity = {
  id: string;
  role: OfficerRole;
  name: string;
};

type AuthenticatedRequest = Request & { officer?: OfficerIdentity };
type JwtClaims = {
  sub?: unknown;
  role?: unknown;
  exp?: unknown;
  iss?: unknown;
};

const roles = new Set<string>(Object.values(OfficerRole));
const rolesMetadataKey = 'janaseva:officer-roles';
const demoOfficerId = 'demo-caseworker';
const demoAuthHeader = 'x-janaseva-demo-auth';
const demoFieldOfficerHeader = 'x-janaseva-demo-field-officer';
const demoReviewOfficerHeader = 'x-janaseva-demo-review-officer';
const demoReviewRoles = new Set<OfficerRole>([
  OfficerRole.AUTHORIZED_OFFICER,
  OfficerRole.ADMIN,
]);

export const OfficerRoles = (...allowedRoles: OfficerRole[]) =>
  SetMetadata(rolesMetadataKey, allowedRoles);

export const CurrentOfficer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): OfficerIdentity => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.officer) {
      throw new UnauthorizedException('Officer authentication is required.');
    }
    return request.officer;
  },
);

@Injectable()
export class OfficerJwtGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const demoEnabled =
      (this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV) !==
        'production' &&
      this.config.get<string>('DOCUMENT_VERIFICATION_DEMO_AUTH_ENABLED') !==
        'false';
    const selectedDemoFieldOfficer = request.headers[demoFieldOfficerHeader];
    if (
      demoEnabled &&
      request.headers[demoAuthHeader] === 'enabled' &&
      typeof selectedDemoFieldOfficer === 'string'
    ) {
      const officer = await this.prisma.user.findUnique({
        where: { id: selectedDemoFieldOfficer },
        select: { id: true, name: true, role: true, isActive: true },
      });
      if (!officer?.isActive || officer.role !== OfficerRole.VA_RI) {
        throw new UnauthorizedException(
          'The selected demonstration field officer is not authorized.',
        );
      }
      request.officer = {
        id: officer.id,
        role: officer.role,
        name: officer.name,
      };
      return true;
    }
    const selectedDemoReviewOfficer = request.headers[demoReviewOfficerHeader];
    if (
      demoEnabled &&
      request.headers[demoAuthHeader] === 'enabled' &&
      typeof selectedDemoReviewOfficer === 'string'
    ) {
      const officer = await this.prisma.user.findUnique({
        where: { id: selectedDemoReviewOfficer },
        select: { id: true, name: true, role: true, isActive: true },
      });
      if (!officer?.isActive || !demoReviewRoles.has(officer.role)) {
        throw new UnauthorizedException(
          'The selected demonstration reviewing officer is not authorized.',
        );
      }
      request.officer = {
        id: officer.id,
        role: officer.role,
        name: officer.name,
      };
      return true;
    }
    if (demoEnabled && request.headers[demoAuthHeader] === 'enabled') {
      const officer = await this.prisma.user.findUnique({
        where: { id: demoOfficerId },
        select: { id: true, name: true, role: true, isActive: true },
      });
      if (!officer?.isActive || officer.role !== OfficerRole.CASEWORKER) {
        throw new UnauthorizedException(
          'The configured demo officer is not authorized.',
        );
      }
      request.officer = {
        id: officer.id,
        role: officer.role,
        name: officer.name,
      };
      return true;
    }

    const secret = this.config.get<string>('DOCUMENT_VERIFICATION_JWT_SECRET');
    if (!secret || Buffer.byteLength(secret) < 32) {
      throw new ServiceUnavailableException(
        'Officer authentication is not configured for document verification.',
      );
    }

    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('A signed officer token is required.');
    }

    const [encodedHeader, encodedClaims, encodedSignature, ...extra] =
      authorization.slice(7).split('.');
    if (
      !encodedHeader ||
      !encodedClaims ||
      !encodedSignature ||
      extra.length > 0
    ) {
      throw new UnauthorizedException('The officer token is invalid.');
    }

    let header: unknown;
    let claims: JwtClaims;
    try {
      header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString());
      claims = JSON.parse(
        Buffer.from(encodedClaims, 'base64url').toString(),
      ) as JwtClaims;
    } catch {
      throw new UnauthorizedException('The officer token is invalid.');
    }

    if (
      !header ||
      typeof header !== 'object' ||
      !claims ||
      typeof claims !== 'object' ||
      (header as { alg?: unknown }).alg !== 'HS256' ||
      (header as { typ?: unknown }).typ !== 'JWT' ||
      claims.iss !==
        (this.config.get<string>('DOCUMENT_VERIFICATION_JWT_ISSUER') ??
          'janaseva-ai-auth') ||
      typeof claims.sub !== 'string' ||
      !claims.sub ||
      typeof claims.role !== 'string' ||
      !roles.has(claims.role) ||
      typeof claims.exp !== 'number' ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException(
        'The officer token is invalid or expired.',
      );
    }

    const expected = createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedClaims}`)
      .digest();
    let provided: Buffer;
    try {
      provided = Buffer.from(encodedSignature, 'base64url');
    } catch {
      throw new UnauthorizedException('The officer token is invalid.');
    }
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new UnauthorizedException('The officer token is invalid.');
    }

    const officer = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, name: true, role: true, isActive: true },
    });
    if (!officer?.isActive || officer.role !== claims.role) {
      throw new UnauthorizedException('The officer is not authorized.');
    }
    request.officer = {
      id: officer.id,
      role: officer.role,
      name: officer.name,
    };
    return true;
  }
}

@Injectable()
export class OfficerRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<OfficerRole[]>(rolesMetadataKey, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (required.length === 0) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.officer || !required.includes(request.officer.role)) {
      throw new ForbiddenException(
        'Your officer role cannot perform this document action.',
      );
    }
    return true;
  }
}
