import {
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { SignJWT } from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { OfficerRole } from '../generated/prisma/enums.js';
import { AuthService } from './auth.service.js';

const secret = 'test-secret-with-more-than-thirty-two-bytes';
const issuer = 'janaseva-auth-test';
const password = 'a-secure-test-password';
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
});

function setup(
  options: {
    credential?: Record<string, unknown> | null;
    attempts?: { attempts: number }[];
    session?: Record<string, unknown> | null;
  } = {},
) {
  const prisma = {
    officerCredential: {
      findUnique: vi.fn().mockResolvedValue(
        options.credential === undefined
          ? {
              userId: 'officer-1',
              username: 'manasvi gowda',
              passwordHash,
              user: {
                id: 'officer-1',
                name: 'Authorized Officer',
                role: OfficerRole.AUTHORIZED_OFFICER,
                isActive: true,
              },
            }
          : options.credential,
      ),
    },
    officerSession: {
      create: vi.fn().mockResolvedValue(undefined),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUnique: vi.fn().mockResolvedValue(
        options.session === undefined
          ? {
              id: 'session-id',
              userId: 'officer-1',
              expiresAt: new Date(Date.now() + 60 * 60 * 1000),
              revokedAt: null,
              user: {
                id: 'officer-1',
                name: 'Authorized Officer',
                role: OfficerRole.AUTHORIZED_OFFICER,
                isActive: true,
              },
            }
          : options.session,
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    authLoginAttempt: {
      findMany: vi.fn().mockResolvedValue(options.attempts ?? []),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  const config = new ConfigService({
    AUTH_JWT_SECRET: secret,
    AUTH_JWT_ISSUER: issuer,
  });
  return {
    prisma,
    service: new AuthService(prisma as never, config),
  };
}

describe('AuthService', () => {
  it('normalizes usernames and creates a short-lived signed session', async () => {
    const { prisma, service } = setup();
    const session = await service.login(
      '  MANASVI GOWDA ',
      password,
      '192.0.2.1',
    );
    expect(session.officer).toEqual({
      id: 'officer-1',
      name: 'Authorized Officer',
      role: OfficerRole.AUTHORIZED_OFFICER,
    });
    expect(prisma.officerCredential.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { username: 'manasvi gowda' } }),
    );
    expect(prisma.officerSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'officer-1' }),
    });
    expect(prisma.officerSession.deleteMany).toHaveBeenCalled();
    const verified = await service.verifySession(session.token);
    expect(verified.id).toBe('officer-1');
    expect(verified.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('uses the same invalid-login response for an incorrect password', async () => {
    const { prisma, service } = setup();
    await expect(
      service.login('reviewer', 'incorrect', '192.0.2.1'),
    ).rejects.toThrow('Invalid username or password.');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    expect(prisma.officerSession.create).not.toHaveBeenCalled();
  });

  it('rejects inactive officers without revealing account state', async () => {
    const { prisma, service } = setup({
      credential: {
        userId: 'officer-1',
        username: 'reviewer',
        passwordHash,
        user: {
          id: 'officer-1',
          name: 'Authorized Officer',
          role: OfficerRole.AUTHORIZED_OFFICER,
          isActive: false,
        },
      },
    });
    await expect(
      service.login('reviewer', password, '192.0.2.1'),
    ).rejects.toThrow('Invalid username or password.');
    expect(prisma.officerSession.create).not.toHaveBeenCalled();
  });

  it('rejects malformed or revoked database sessions', async () => {
    const invalidSession = await new SignJWT({
      role: OfficerRole.AUTHORIZED_OFFICER,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(issuer)
      .setSubject('officer-1')
      .setJti('session-id')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));
    const { service } = setup({
      session: {
        id: 'session-id',
        userId: 'officer-1',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
        user: {
          id: 'officer-1',
          name: 'Authorized Officer',
          role: OfficerRole.AUTHORIZED_OFFICER,
          isActive: true,
        },
      },
    });
    await expect(service.verifySession(invalidSession)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects expired database sessions even when the JWT has not expired', async () => {
    const sessionToken = await new SignJWT({
      role: OfficerRole.AUTHORIZED_OFFICER,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(issuer)
      .setSubject('officer-1')
      .setJti('session-id')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));
    const { service } = setup({
      session: {
        id: 'session-id',
        userId: 'officer-1',
        expiresAt: new Date(Date.now() - 1),
        revokedAt: null,
        user: {
          id: 'officer-1',
          name: 'Authorized Officer',
          role: OfficerRole.AUTHORIZED_OFFICER,
          isActive: true,
        },
      },
    });
    await expect(service.verifySession(sessionToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('limits repeated failures using the database-backed window', async () => {
    const { prisma, service } = setup({
      attempts: [{ attempts: 5 }],
    });
    const error = await service
      .login('reviewer', password, '192.0.2.1')
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    expect(prisma.officerCredential.findUnique).not.toHaveBeenCalled();
  });

  it('revokes an existing session on logout and safely ignores invalid tokens', async () => {
    const { prisma, service } = setup();
    const token = await new SignJWT({ role: OfficerRole.AUTHORIZED_OFFICER })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(issuer)
      .setSubject('officer-1')
      .setJti('session-id')
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
      .sign(new TextEncoder().encode(secret));
    await service.revokeSession(token);
    expect(prisma.officerSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-id', userId: 'officer-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    await expect(service.revokeSession('invalid')).resolves.toBeUndefined();
  });
});
