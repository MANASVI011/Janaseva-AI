import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { FieldVerificationModule } from './field-verification/field-verification.module.js';
import { OperationsModule } from './operations/operations.module.js';
import { FinalReviewModule } from './final-review/final-review.module.js';
import { AiAnalysisModule } from './ai-analysis/ai-analysis.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    DocumentsModule,
    FieldVerificationModule,
    OperationsModule,
    FinalReviewModule,
    AiAnalysisModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
