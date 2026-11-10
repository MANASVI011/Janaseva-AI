import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import {
  CurrentOfficer,
  OfficerJwtGuard,
  OfficerRoles,
  OfficerRolesGuard,
  type OfficerIdentity,
} from '../auth/officer-auth.js';
import { OfficerRole } from '../generated/prisma/enums.js';
import { MAX_DOCUMENT_BYTES } from './document-storage.service.js';
import { DocumentsService } from './documents.service.js';

const allOfficerRoles = [
  OfficerRole.CASEWORKER,
  OfficerRole.VA_RI,
  OfficerRole.AUTHORIZED_OFFICER,
  OfficerRole.ADMIN,
];
const documentReviewRoles = [
  OfficerRole.CASEWORKER,
  OfficerRole.AUTHORIZED_OFFICER,
  OfficerRole.ADMIN,
];

@Controller('api')
@UseGuards(OfficerJwtGuard, OfficerRolesGuard)
@OfficerRoles(...allOfficerRoles)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('applications')
  listApplications(@Query() query: Record<string, unknown>) {
    return this.documents.listApplications(query);
  }

  @Get('document-verification')
  listQueue(@Query() query: Record<string, unknown>) {
    return this.documents.listVerificationQueue(query);
  }

  @Get('document-verification/officers')
  listOfficers() {
    return this.documents.listOfficers();
  }

  @Get('applications/:applicationId/documents')
  listApplicationDocuments(@Param('applicationId') applicationId: string) {
    return this.documents.listApplicationDocuments(applicationId);
  }

  @Post('applications/:applicationId/documents')
  @OfficerRoles(...documentReviewRoles, OfficerRole.VA_RI)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
    }),
  )
  upload(
    @Param('applicationId') applicationId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() fields: Record<string, unknown>,
    @CurrentOfficer() officer: OfficerIdentity,
  ) {
    return this.documents.upload(applicationId, file, fields, officer);
  }

  @Post('applications/:applicationId/request-missing-documents')
  @OfficerRoles(...documentReviewRoles)
  requestMissingDocuments(
    @Param('applicationId') applicationId: string,
    @Body() body: Record<string, unknown>,
    @CurrentOfficer() officer: OfficerIdentity,
  ) {
    return this.documents.requestMissing(applicationId, body, officer);
  }

  @Get('applications/:applicationId/document-history')
  history(@Param('applicationId') applicationId: string) {
    return this.documents.history(applicationId);
  }

  @Get('documents/:documentId/preview')
  async preview(
    @Param('documentId') documentId: string,
    @Query('version') versionId: string | undefined,
    @Query('download') download: string | undefined,
    @CurrentOfficer() officer: OfficerIdentity,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (download && download !== '1') {
      throw new BadRequestException('The download parameter is invalid.');
    }
    const { version, application, buffer } = await this.documents.preview(
      documentId,
      versionId,
      officer,
    );
    const filename = encodeURIComponent(version.originalFilename);
    response.set({
      'Content-Type': version.mimeType,
      'Content-Length': String(buffer.length),
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="document"; filename*=UTF-8''${filename}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none';",
      'Cache-Control': 'private, no-store',
      'X-Application-Id': application.id,
    });
    return new StreamableFile(buffer);
  }

  @Post('documents/:documentId/verify')
  @OfficerRoles(...documentReviewRoles)
  verify(
    @Param('documentId') documentId: string,
    @Body() body: Record<string, unknown>,
    @CurrentOfficer() officer: OfficerIdentity,
  ) {
    return this.documents.verify(documentId, body, officer);
  }

  @Post('documents/:documentId/reject')
  @OfficerRoles(...documentReviewRoles)
  reject(
    @Param('documentId') documentId: string,
    @Body() body: Record<string, unknown>,
    @CurrentOfficer() officer: OfficerIdentity,
  ) {
    return this.documents.reject(documentId, body, officer);
  }

  @Post('documents/:documentId/request-replacement')
  @OfficerRoles(...documentReviewRoles)
  requestReplacement(
    @Param('documentId') documentId: string,
    @Body() body: Record<string, unknown>,
    @CurrentOfficer() officer: OfficerIdentity,
  ) {
    return this.documents.requestReplacement(documentId, body, officer);
  }

  @Patch('documents/:documentId/required')
  @OfficerRoles(...documentReviewRoles)
  markRequired(
    @Param('documentId') documentId: string,
    @Body() body: Record<string, unknown>,
    @CurrentOfficer() officer: OfficerIdentity,
  ) {
    return this.documents.setRequired(documentId, body, officer);
  }
}
