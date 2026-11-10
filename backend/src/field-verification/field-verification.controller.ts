import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentOfficer,
  OfficerJwtGuard,
  OfficerRoles,
  OfficerRolesGuard,
  type OfficerIdentity,
} from '../auth/officer-auth.js';
import { OfficerRole } from '../generated/prisma/enums.js';
import { FieldVerificationService } from './field-verification.service.js';

const fieldRoles = [
  OfficerRole.CASEWORKER,
  OfficerRole.VA_RI,
  OfficerRole.AUTHORIZED_OFFICER,
  OfficerRole.ADMIN,
];

@Controller('api')
@UseGuards(OfficerJwtGuard, OfficerRolesGuard)
@OfficerRoles(...fieldRoles)
export class FieldVerificationController {
  constructor(private readonly field: FieldVerificationService) {}

  @Get('field-verification')
  queue(@Query() query: Record<string, unknown>) {
    return this.field.listQueue(query);
  }

  @Get('field-verification/officers')
  officers() {
    return this.field.listOfficers();
  }

  @Post('field-verification/assist')
  assist(@Body() body: Record<string, unknown>) {
    return this.field.assist(body);
  }

  @Get('applications/:applicationId/field-verification')
  application(@Param('applicationId') applicationId: string) {
    return this.field.getApplication(applicationId);
  }

  @Post('applications/:applicationId/field-verification/assign')
  assign(
    @Param('applicationId') applicationId: string,
    @Body() body: Record<string, unknown>,
    @CurrentOfficer() officer: OfficerIdentity,
  ) {
    return this.field.assign(applicationId, body, officer);
  }

  @Post('applications/:applicationId/field-verification/schedule')
  schedule(
    @Param('applicationId') applicationId: string,
    @Body() body: Record<string, unknown>,
    @CurrentOfficer() officer: OfficerIdentity,
  ) {
    return this.field.schedule(applicationId, body, officer);
  }

  @Patch('field-verification/:id/schedule')
  reschedule(
    @Param('id') verificationId: string,
    @Body() body: Record<string, unknown>,
    @CurrentOfficer() officer: OfficerIdentity,
  ) {
    return this.field.reschedule(verificationId, body, officer);
  }

  @Post('field-verification/:id/start')
  startVisit(
    @Param('id') verificationId: string,
    @CurrentOfficer() officer: OfficerIdentity,
  ) {
    return this.field.startVisit(verificationId, officer);
  }

  @Put('field-verification/:id/draft')
  saveDraft(
    @Param('id') verificationId: string,
    @Body() body: Record<string, unknown>,
    @CurrentOfficer() officer: OfficerIdentity,
  ) {
    return this.field.saveDraft(verificationId, body, officer);
  }

  @Post('field-verification/:id/submit')
  submit(
    @Param('id') verificationId: string,
    @Body() body: Record<string, unknown>,
    @CurrentOfficer() officer: OfficerIdentity,
  ) {
    return this.field.submitReport(verificationId, body, officer);
  }

  @Get('field-verification/:id/history')
  history(@Param('id') verificationId: string) {
    return this.field.history(verificationId);
  }
}
