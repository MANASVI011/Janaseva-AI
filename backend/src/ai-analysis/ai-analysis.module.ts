import { Module } from '@nestjs/common';
import { OfficerRolesGuard } from '../auth/officer-auth.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AiAnalysisController } from './ai-analysis.controller.js';
import { AiAnalysisService } from './ai-analysis.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AiAnalysisController],
  providers: [AiAnalysisService, OfficerRolesGuard],
})
export class AiAnalysisModule {}
