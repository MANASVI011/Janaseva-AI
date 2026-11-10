import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { FieldVerificationModule } from './field-verification/field-verification.module.js';
import { OperationsModule } from './operations/operations.module.js';
import { FinalReviewModule } from './final-review/final-review.module.js';
import { AiAnalysisModule } from './ai-analysis/ai-analysis.module.js';
import { getBackendEnvFileOptions } from './config/environment.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthOriginGuard } from './auth/auth-security.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ...getBackendEnvFileOptions(),
    }),
    AuthModule,
    PrismaModule,
    DocumentsModule,
    FieldVerificationModule,
    OperationsModule,
    FinalReviewModule,
    AiAnalysisModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AuthOriginGuard }],
})
export class AppModule {}
