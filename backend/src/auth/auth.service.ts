import {
  Injectable,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { compactVerify, SignJWT, jwtVerify } from 'jose';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { OfficerRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { OfficerIdentity } from './officer-auth.js';

const sessionLifetimeSeconds = 8 * 60 * 60;
const loginWindowMilliseconds = 15 * 60 * 1000;
const maxLoginAttempts = 5;
const argonOptions: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};
const allowedRoles = new Set<string>(Object.values(OfficerRole));

export type LoginSession = {
  token: string;
  expiresAt: Date;
  officer: OfficerIdentity;
};

export function normalizeUsername(username: string) {
  return username.normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

function rateLimitKey(kind: 'username' | 'ip', value: string) {
  return createHash('sha256').update(`${kind}:${value}`).digest('hex');
}

@Injectable()
export class AuthService {
  private dummyPasswordHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async login(
    usernameInput: unknown,
    passwordInput: unknown,
    clientAddress: string,
  ): Promise<LoginSession> {
    if (
      typeof usernameInput !== 'string' ||
      typeof passwordInput !== 'string' ||
      usernameInput.length > 128 ||
      passwordInput.length > 256
    ) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    const username = normalizeUsername(usernameInput);
    if (!username || !passwordInput) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    const limiterKeys = [
      rateLimitKey('username', username),
      rateLimitKey('ip', clientAddress || 'unknown'),
    ];
    await this.assertLoginNotRateLimited(limiterKeys);

    const credential = await this.prisma.officerCredential.findUnique({
      where: { username },
      include: { user: true },
    });

    let passwordMatches = false;
    try {
      passwordMatches = await argon2.verify(
        credential?.passwordHash ?? (await this.getDummyPasswordHash()),
        passwordInput,
      );
    } catch {
      passwordMatches = false;
    }

    if (
      !credential ||
      !passwordMatches ||
      !credential.user.isActive ||
      !allowedRoles.has(credential.user.role)
    ) {
      await this.recordFailedLogin(limiterKeys);
      throw new UnauthorizedException('Invalid username or password.');
    }

    await this.prisma.authLoginAttempt.deleteMany({
      where: { key: { in: limiterKeys } },
    });
    await this.prisma.officerSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    const secret = this.getJwtSecret();
    const issuer = this.getIssuer();
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1000);
    const officer = {
      id: credential.user.id,
      name: credential.user.name,
      role: credential.user.role,
    };

    await this.prisma.officerSession.create({
      data: { id, userId: officer.id, expiresAt },
    });

    try {
      const token = await new SignJWT({ role: officer.role })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(issuer)
        .setSubject(officer.id)
        .setJti(id)
        .setIssuedAt()
        .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
        .sign(secret);
      return { token, expiresAt, officer };
    } catch (error) {
      await this.prisma.officerSession.delete({ where: { id } });
      throw error;
    }
  }

  async verifySession(token: string) {
    const { payload } = await jwtVerify(token, this.getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: this.getIssuer(),
      maxTokenAge: `${sessionLifetimeSeconds}s`,
    });
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string' ||
      typeof payload.role !== 'string' ||
      !allowedRoles.has(payload.role) ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedException('The officer session is invalid.');
    }

    const session = await this.prisma.officerSession.findUnique({
      where: { id: payload.jti },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      session.userId !== payload.sub ||
      !session.user.isActive ||
      session.user.role !== payload.role
    ) {
      throw new UnauthorizedException('The officer session is invalid.');
    }

    return {
      id: session.user.id,
      name: session.user.name,
      role: session.user.role,
      expiresAt: session.expiresAt,
    };
  }

  async revokeSession(token: string | undefined) {
    if (!token) return;
    const secret = this.getJwtSecret();
    const issuer = this.getIssuer();
    let payload: unknown;
    try {
      const { payload: encodedPayload } = await compactVerify(token, secret, {
        algorithms: ['HS256'],
      });
      payload = JSON.parse(new TextDecoder().decode(encodedPayload));
    } catch {
      return;
    }
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('iss' in payload) ||
      payload.iss !== issuer ||
      !('jti' in payload) ||
      typeof payload.jti !== 'string' ||
      !('sub' in payload) ||
      typeof payload.sub !== 'string'
    ) {
      return;
    }
    await this.prisma.officerSession.updateMany({
      where: {
        id: payload.jti,
        userId: payload.sub,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async recordFailedLogin(keys: string[]) {
    const now = new Date();
    for (const key of keys) {
      await this.prisma.$executeRaw`
        INSERT INTO "AuthLoginAttempt"
          ("key", "attempts", "windowStartedAt", "createdAt", "updatedAt")
        VALUES (${key}, 1, ${now}, ${now}, ${now})
        ON CONFLICT ("key") DO UPDATE SET
          "attempts" = CASE
            WHEN "AuthLoginAttempt"."windowStartedAt" <
              ${new Date(now.getTime() - loginWindowMilliseconds)}
            THEN 1
            ELSE "AuthLoginAttempt"."attempts" + 1
          END,
          "windowStartedAt" = CASE
            WHEN "AuthLoginAttempt"."windowStartedAt" <
              ${new Date(now.getTime() - loginWindowMilliseconds)}
            THEN ${now}
            ELSE "AuthLoginAttempt"."windowStartedAt"
          END,
          "updatedAt" = ${now}
      `;
    }
    await this.prisma.authLoginAttempt.deleteMany({
      where: {
        windowStartedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    });
  }

  private async assertLoginNotRateLimited(keys: string[]) {
    const cutoff = new Date(Date.now() - loginWindowMilliseconds);
    const attempts = await this.prisma.authLoginAttempt.findMany({
      where: { key: { in: keys }, windowStartedAt: { gte: cutoff } },
      select: { attempts: true },
    });
    if (attempts.some((entry) => entry.attempts >= maxLoginAttempts)) {
      throw new HttpException(
        'Too many login attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private getJwtSecret() {
    const value = this.config.get<string>('AUTH_JWT_SECRET');
    if (!value || Buffer.byteLength(value) < 32) {
      throw new ServiceUnavailableException(
        'Officer authentication is not configured.',
      );
    }
    return new TextEncoder().encode(value);
  }

  private getDummyPasswordHash() {
    this.dummyPasswordHash ??= argon2.hash(
      randomBytes(32).toString('hex'),
      argonOptions,
    );
    return this.dummyPasswordHash;
  }

  private getIssuer() {
    return this.config.get<string>('AUTH_JWT_ISSUER') ?? 'janaseva-ai-auth';
  }
}

export { sessionLifetimeSeconds };
