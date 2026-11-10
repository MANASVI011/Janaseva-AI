import { Module } from '@nestjs/common';
import { OfficerJwtGuard, OfficerRolesGuard } from '../auth/officer-auth.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { HistoryService } from './history.service.js';
import { OperationsController } from './operations.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [OperationsController],
  providers: [
    HistoryService,
    ReportsService,
    OfficerJwtGuard,
    OfficerRolesGuard,
  ],
})
export class OperationsModule {}
