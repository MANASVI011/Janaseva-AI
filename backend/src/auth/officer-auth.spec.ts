import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { OfficerRole } from '../generated/prisma/enums.js';
import { OfficerJwtGuard } from './officer-auth.js';

const secret = 'local-test-secret-with-at-least-thirty-two-bytes';
const issuer = 'janaseva-ai-auth';

function token(claims: Record<string, unknown>, signingSecret = secret) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', signingSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function context(
  authorization?: string,
  demoAuth?: string,
  demoReviewOfficer?: string,
) {
  const request = {
    headers: {
      authorization,
      ...(demoAuth ? { 'x-janaseva-demo-auth': demoAuth } : {}),
      ...(demoReviewOfficer
        ? { 'x-janaseva-demo-review-officer': demoReviewOfficer }
        : {}),
    },
  };
  return {
    request,
    execution: {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext,
  };
}

let contextValue: ReturnType<typeof context>;

function createGuard(
  secretValue = secret,
  nodeEnv?: string,
  demoEnabled?: string,
) {
  const config = new ConfigService({
    DOCUMENT_VERIFICATION_JWT_SECRET: secretValue,
    DOCUMENT_VERIFICATION_JWT_ISSUER: issuer,
    NODE_ENV: nodeEnv,
    DOCUMENT_VERIFICATION_DEMO_AUTH_ENABLED: demoEnabled,
  });
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'demo-caseworker',
        name: 'Demo Officer',
        role: OfficerRole.CASEWORKER,
        isActive: true,
      }),
    },
  };
  return { guard: new OfficerJwtGuard(config, prisma as never), prisma };
}

function validClaims() {
  return {
    sub: 'demo-caseworker',
    role: OfficerRole.CASEWORKER,
    iss: issuer,
    exp: Math.floor(Date.now() / 1000) + 60,
  };
}

describe('OfficerJwtGuard', () => {
  it('accepts a signed, unexpired token for an active matching officer', async () => {
    const requestContext = context(`Bearer ${token(validClaims())}`);
    contextValue = requestContext;
    const { guard, prisma } = createGuard();

    await expect(guard.canActivate(requestContext.execution)).resolves.toBe(
      true,
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'demo-caseworker' },
      select: { id: true, name: true, role: true, isActive: true },
    });
    expect(requestContext.request).toHaveProperty('officer', {
      id: 'demo-caseworker',
      name: 'Demo Officer',
      role: OfficerRole.CASEWORKER,
    });
  });

  it('rejects invalid signatures and expired tokens', async () => {
    const invalidSignature = token(validClaims(), `${secret}-wrong`);
    const expired = token({
      ...validClaims(),
      exp: Math.floor(Date.now() / 1000) - 1,
    });
    const { guard } = createGuard();

    contextValue = context(`Bearer ${invalidSignature}`);
    await expect(
      guard.canActivate(contextValue.execution),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    contextValue = context(`Bearer ${expired}`);
    await expect(
      guard.canActivate(contextValue.execution),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('fails closed when the signing secret is missing or too short', async () => {
    const { guard } = createGuard('short');
    contextValue = context(`Bearer ${token(validClaims())}`);
    await expect(
      guard.canActivate(contextValue.execution),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('authenticates the seeded caseworker in explicitly marked demo mode without a JWT', async () => {
    const requestContext = context(undefined, 'enabled');
    contextValue = requestContext;
    const { guard, prisma } = createGuard('', 'development', 'true');

    await expect(guard.canActivate(requestContext.execution)).resolves.toBe(
      true,
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'demo-caseworker' },
      select: { id: true, name: true, role: true, isActive: true },
    });
  });

  it('accepts a selected active authorised officer only in demo mode', async () => {
    const requestContext = context(
      undefined,
      'enabled',
      'demo-authorized-officer',
    );
    contextValue = requestContext;
    const { guard, prisma } = createGuard('', 'development', 'true');
    prisma.user.findUnique.mockResolvedValue({
      id: 'demo-authorized-officer',
      name: 'Synthetic Demonstration Authorised Officer',
      role: OfficerRole.AUTHORIZED_OFFICER,
      isActive: true,
    });

    await expect(guard.canActivate(requestContext.execution)).resolves.toBe(
      true,
    );
    expect(requestContext.request).toHaveProperty('officer', {
      id: 'demo-authorized-officer',
      name: 'Synthetic Demonstration Authorised Officer',
      role: OfficerRole.AUTHORIZED_OFFICER,
    });
  });

  it('rejects a selected demonstration reviewer without a reviewing role', async () => {
    const requestContext = context(undefined, 'enabled', 'demo-va-ri-sagara');
    contextValue = requestContext;
    const { guard, prisma } = createGuard('', 'development', 'true');
    prisma.user.findUnique.mockResolvedValue({
      id: 'demo-va-ri-sagara',
      name: 'Synthetic VA / RI',
      role: OfficerRole.VA_RI,
      isActive: true,
    });

    await expect(
      guard.canActivate(requestContext.execution),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('never accepts demo authentication in production', async () => {
    const requestContext = context(undefined, 'enabled');
    contextValue = requestContext;
    const { guard } = createGuard(secret, 'production', 'true');

    await expect(
      guard.canActivate(requestContext.execution),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not use demo authentication when the mode is disabled', async () => {
    const requestContext = context(undefined, 'enabled');
    contextValue = requestContext;
    const { guard } = createGuard(secret, 'development', 'false');

    await expect(
      guard.canActivate(requestContext.execution),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects inactive or role-mismatched database officers', async () => {
    const requestContext = context(`Bearer ${token(validClaims())}`);
    contextValue = requestContext;
    const { guard, prisma } = createGuard();
    prisma.user.findUnique.mockResolvedValue({
      id: 'demo-caseworker',
      name: 'Demo Officer',
      role: OfficerRole.CASEWORKER,
      isActive: false,
    });

    await expect(guard.canActivate(requestContext.execution)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
