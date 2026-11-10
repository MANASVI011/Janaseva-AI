import { Module } from '@nestjs/common';
import { OfficerJwtGuard, OfficerRolesGuard } from '../auth/officer-auth.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DocumentStorageService } from './document-storage.service.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentStorageService,
    OfficerJwtGuard,
    OfficerRolesGuard,
  ],
})
export class DocumentsModule {}
