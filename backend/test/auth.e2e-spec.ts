import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { OfficerRole } from '../src/generated/prisma/enums.js';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { OfficerJwtGuard } from '../src/auth/officer-auth.js';

describe('Auth API routing (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: vi.fn().mockResolvedValue({
              token: 'test-session-token',
              expiresAt: new Date('2026-11-10T18:00:00.000Z'),
              officer: {
                id: 'demo-authorized-officer',
                name: 'Authorized Officer',
                role: OfficerRole.AUTHORIZED_OFFICER,
              },
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: new ConfigService({ NODE_ENV: 'development' }),
        },
      ],
    });
    builder
      .overrideGuard(OfficerJwtGuard)
      .useValue({ canActivate: () => true });
    const moduleRef = await builder.compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves login on the same /api/auth path used by the frontend', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'test officer', password: 'test password' })
      .expect(201);

    expect(response.body.officer).toMatchObject({
      id: 'demo-authorized-officer',
      role: OfficerRole.AUTHORIZED_OFFICER,
    });
    expect(response.body).not.toHaveProperty('token');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
  });
});
