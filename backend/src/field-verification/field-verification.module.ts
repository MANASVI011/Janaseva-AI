import { Module } from '@nestjs/common';
import { OfficerJwtGuard, OfficerRolesGuard } from '../auth/officer-auth.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { FieldVerificationController } from './field-verification.controller.js';
import { FieldVerificationService } from './field-verification.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [FieldVerificationController],
  providers: [FieldVerificationService, OfficerJwtGuard, OfficerRolesGuard],
})
export class FieldVerificationModule {}
