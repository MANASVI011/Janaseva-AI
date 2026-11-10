import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OfficerJwtGuard } from './officer-auth.js';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, OfficerJwtGuard],
  exports: [AuthService, OfficerJwtGuard],
})
export class AuthModule {}
