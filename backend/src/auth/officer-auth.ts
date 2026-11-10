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
import type { Request } from 'express';
import { OfficerRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { getCookieValue, officerSessionCookie } from './auth-security.js';

export type OfficerIdentity = {
  id: string;
  role: OfficerRole;
  name: string;
};

type AuthenticatedRequest = Request & {
  officer?: OfficerIdentity;
  officerExpiresAt?: Date;
};
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
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const productionDemoMode = this.config.get<string>('DEMO_MODE') === 'true';
    const token = productionDemoMode
      ? undefined
      : (getCookieValue(request, officerSessionCookie) ??
        (request.headers.authorization?.startsWith('Bearer ')
          ? request.headers.authorization.slice(7)
          : undefined));
    if (token) {
      let officer: Awaited<ReturnType<AuthService['verifySession']>>;
      try {
        officer = await this.auth.verifySession(token);
      } catch (error) {
        if (error instanceof ServiceUnavailableException) throw error;
        throw new UnauthorizedException('The officer session is invalid.');
      }
      request.officer = {
        id: officer.id,
        role: officer.role,
        name: officer.name,
      };
      request.officerExpiresAt = officer.expiresAt;
      return true;
    }

    const demoEnabled =
      productionDemoMode ||
      ((this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV) !==
        'production' &&
        this.config.get<string>('DOCUMENT_VERIFICATION_DEMO_AUTH_ENABLED') !==
          'false');
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
      const defaultDemoOfficer = productionDemoMode
        ? {
            id: 'demo-authorized-officer',
            role: OfficerRole.AUTHORIZED_OFFICER,
          }
        : { id: demoOfficerId, role: OfficerRole.CASEWORKER };
      const officer = await this.prisma.user.findUnique({
        where: { id: defaultDemoOfficer.id },
        select: { id: true, name: true, role: true, isActive: true },
      });
      if (!officer?.isActive || officer.role !== defaultDemoOfficer.role) {
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

    throw new UnauthorizedException('An officer session is required.');
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
