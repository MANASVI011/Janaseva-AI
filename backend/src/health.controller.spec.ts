import { HealthController } from './health.controller.js';
import { PrismaService } from './prisma/prisma.service.js';
import { Test } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';

describe('HealthController', () => {
  const prisma = { $queryRaw: vi.fn() };
  let controller: HealthController;

  beforeEach(async () => {
    prisma.$queryRaw.mockReset().mockResolvedValue([{ '?column?': 1 }]);
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();
    controller = module.get(HealthController);
  });

  it('returns the backend health status when the database is available', async () => {
    await expect(controller.getHealth()).resolves.toEqual({
      status: 'ok',
      service: 'backend',
    });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it('reports the database as unavailable when its readiness check fails', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(
      new Error('database connection failed'),
    );
    await expect(controller.getHealth()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
