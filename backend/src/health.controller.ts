import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (cause) {
      throw new ServiceUnavailableException('Database is unavailable.', {
        cause,
      });
    }

    return {
      status: 'ok',
      service: 'backend',
    };
  }
}
