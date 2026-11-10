import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { OfficerRole } from '../generated/prisma/enums.js';
import { OfficerJwtGuard, OfficerRolesGuard } from './officer-auth.js';
import {
  AuthOriginGuard,
  getCookieValue,
  getSessionCookieOptions,
} from './auth-security.js';

function context(
  options: {
    method?: string;
    cookie?: string;
    authorization?: string;
    demoAuth?: string;
    demoFieldOfficer?: string;
    demoReviewOfficer?: string;
    origin?: string;
  } = {},
) {
  const request = {
    method: options.method ?? 'GET',
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.authorization
        ? { authorization: options.authorization }
        : {}),
      ...(options.demoAuth ? { 'x-janaseva-demo-auth': options.demoAuth } : {}),
      ...(options.demoFieldOfficer
        ? { 'x-janaseva-demo-field-officer': options.demoFieldOfficer }
        : {}),
      ...(options.demoReviewOfficer
        ? { 'x-janaseva-demo-review-officer': options.demoReviewOfficer }
        : {}),
      ...(options.origin ? { origin: options.origin } : {}),
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

function createGuard(nodeEnv = 'production', demoEnabled = 'true') {
  const config = new ConfigService({
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
  const auth = {
    verifySession: vi.fn().mockResolvedValue({
      id: 'officer-1',
      name: 'Authorized Officer',
      role: OfficerRole.AUTHORIZED_OFFICER,
      expiresAt: new Date(Date.now() + 60_000),
    }),
  };
  return {
    guard: new OfficerJwtGuard(config, prisma as never, auth as never),
    prisma,
    auth,
  };
}

describe('OfficerJwtGuard', () => {
  it('authenticates a valid httpOnly session cookie and uses its database identity', async () => {
    const requestContext = context({ cookie: 'janaseva_session=signed-token' });
    const { guard, auth } = createGuard();
    await expect(guard.canActivate(requestContext.execution)).resolves.toBe(
      true,
    );
    expect(auth.verifySession).toHaveBeenCalledWith('signed-token');
    expect(requestContext.request).toHaveProperty('officer', {
      id: 'officer-1',
      name: 'Authorized Officer',
      role: OfficerRole.AUTHORIZED_OFFICER,
    });
  });

  it('prefers a valid session cookie over local demo headers', async () => {
    const requestContext = context({
      cookie: 'janaseva_session=signed-token',
      demoAuth: 'enabled',
      demoFieldOfficer: 'demo-caseworker',
    });
    const { guard, auth, prisma } = createGuard('development', 'true');
    await expect(guard.canActivate(requestContext.execution)).resolves.toBe(
      true,
    );
    expect(auth.verifySession).toHaveBeenCalledWith('signed-token');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(requestContext.request).toHaveProperty('officer', {
      id: 'officer-1',
      name: 'Authorized Officer',
      role: OfficerRole.AUTHORIZED_OFFICER,
    });
  });

  it('supports registered bearer sessions for non-browser clients', async () => {
    const requestContext = context({
      authorization: 'Bearer signed-token',
    });
    const { guard, auth } = createGuard();
    await expect(guard.canActivate(requestContext.execution)).resolves.toBe(
      true,
    );
    expect(auth.verifySession).toHaveBeenCalledWith('signed-token');
  });

  it('rejects unauthenticated production requests even when demo headers are set', async () => {
    const requestContext = context({ demoAuth: 'enabled' });
    const { guard, prisma } = createGuard();
    await expect(
      guard.canActivate(requestContext.execution),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('allows the configured local caseworker demo only outside production', async () => {
    const requestContext = context({ demoAuth: 'enabled' });
    const { guard, prisma } = createGuard('development', 'true');
    await expect(guard.canActivate(requestContext.execution)).resolves.toBe(
      true,
    );
    expect(prisma.user.findUnique).toHaveBeenCalled();
  });

  it('rejects a selected inactive field officer', async () => {
    const requestContext = context({
      demoAuth: 'enabled',
      demoFieldOfficer: 'inactive-officer',
    });
    const { guard, prisma } = createGuard('development', 'true');
    prisma.user.findUnique.mockResolvedValue({
      id: 'inactive-officer',
      name: 'Inactive officer',
      role: OfficerRole.VA_RI,
      isActive: false,
    });
    await expect(
      guard.canActivate(requestContext.execution),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthOriginGuard', () => {
  const guard = new AuthOriginGuard(
    new ConfigService({
      NODE_ENV: 'production',
      FRONTEND_ORIGIN: 'https://janaseva.example',
    }),
  );

  it('allows a state-changing request from the configured application origin', () => {
    expect(
      guard.canActivate(
        context({
          method: 'POST',
          origin: 'https://janaseva.example',
        }).execution,
      ),
    ).toBe(true);
  });

  it('rejects missing and untrusted origins for state-changing requests', () => {
    expect(() =>
      guard.canActivate(context({ method: 'POST' }).execution),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(
        context({ method: 'POST', origin: 'https://attacker.example' })
          .execution,
      ),
    ).toThrow(ForbiddenException);
  });

  it('does not require an Origin header for safe requests', () => {
    expect(guard.canActivate(context({ method: 'GET' }).execution)).toBe(true);
  });
});

describe('session cookie helpers', () => {
  it('extracts the session cookie without decoding or logging it', () => {
    expect(
      getCookieValue(
        {
          headers: { cookie: 'other=value; janaseva_session=opaque' },
        } as never,
        'janaseva_session',
      ),
    ).toBe('opaque');
  });

  it('sets Secure only in production while always using HttpOnly and SameSite=Lax', () => {
    expect(getSessionCookieOptions(true)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
    expect(getSessionCookieOptions(false)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });
  });
});

describe('OfficerRolesGuard', () => {
  it('denies caseworkers access to authorized-officer actions', () => {
    const guard = new OfficerRolesGuard({
      getAllAndOverride: () => [
        OfficerRole.AUTHORIZED_OFFICER,
        OfficerRole.ADMIN,
      ],
    } as never);
    const execution = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({
          officer: {
            id: 'caseworker-1',
            name: 'Caseworker',
            role: OfficerRole.CASEWORKER,
          },
        }),
      }),
    };
    expect(() => guard.canActivate(execution as never)).toThrow(
      ForbiddenException,
    );
  });
});
