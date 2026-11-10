import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { OfficerRole } from '../generated/prisma/enums.js';
import { AuthController } from './auth.controller.js';

function controller(isProduction = true) {
  const auth = {
    login: vi.fn().mockResolvedValue({
      token: 'opaque-signed-session',
      expiresAt: new Date('2026-11-10T18:00:00.000Z'),
      officer: {
        id: 'officer-1',
        name: 'Authorized Officer',
        role: OfficerRole.AUTHORIZED_OFFICER,
      },
    }),
    revokeSession: vi.fn().mockResolvedValue(undefined),
  };
  const config = new ConfigService({
    NODE_ENV: isProduction ? 'production' : 'development',
  });
  return { instance: new AuthController(auth as never, config), auth };
}

describe('AuthController cookies and session endpoints', () => {
  it('sets a Secure, HttpOnly, SameSite=Lax cookie and never returns the JWT', async () => {
    const { instance } = controller();
    const response = { cookie: vi.fn() };
    const result = await instance.login(
      { username: 'reviewer', password: 'not-returned' },
      { ip: '192.0.2.5' } as never,
      response as never,
    );
    expect(response.cookie).toHaveBeenCalledWith(
      'janaseva_session',
      'opaque-signed-session',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
    expect(result).not.toHaveProperty('token');
    expect(JSON.stringify(result)).not.toContain('opaque-signed-session');
  });

  it('sets a non-Secure cookie only for local development', async () => {
    const { instance } = controller(false);
    const response = { cookie: vi.fn() };
    await instance.login(
      { username: 'reviewer', password: 'not-returned' },
      { ip: '127.0.0.1' } as never,
      response as never,
    );
    expect(response.cookie).toHaveBeenCalledWith(
      'janaseva_session',
      'opaque-signed-session',
      expect.objectContaining({ secure: false, httpOnly: true }),
    );
  });

  it('revokes the cookie session and clears the cookie on logout', async () => {
    const { instance, auth } = controller();
    const response = { clearCookie: vi.fn() };
    const result = await instance.logout(
      {
        headers: {
          cookie: 'janaseva_session=opaque-signed-session',
        },
      } as never,
      response as never,
    );
    expect(auth.revokeSession).toHaveBeenCalledWith('opaque-signed-session');
    expect(response.clearCookie).toHaveBeenCalledWith(
      'janaseva_session',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      }),
    );
    expect(result).toEqual({ success: true });
  });
});
