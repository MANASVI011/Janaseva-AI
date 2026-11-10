import { Module } from '@nestjs/common';
import { OfficerRolesGuard } from '../auth/officer-auth.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { FinalReviewController } from './final-review.controller.js';
import { FinalReviewService } from './final-review.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [FinalReviewController],
  providers: [FinalReviewService, OfficerRolesGuard],
})
export class FinalReviewModule {}
