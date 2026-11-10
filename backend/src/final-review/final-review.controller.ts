import {
  Body,
  Controller,
  Get,
  Param,
  Post,
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
import { FinalReviewService } from './final-review.service.js';

const allOfficerRoles = [
  OfficerRole.CASEWORKER,
  OfficerRole.VA_RI,
  OfficerRole.AUTHORIZED_OFFICER,
  OfficerRole.ADMIN,
];

@Controller('api')
@UseGuards(OfficerJwtGuard, OfficerRolesGuard)
@OfficerRoles(...allOfficerRoles)
export class FinalReviewController {
  constructor(private readonly finalReview: FinalReviewService) {}

  @Get('final-review')
  queue(@Query() query: Record<string, unknown>) {
    return this.finalReview.listQueue(query);
  }

  @Get('applications/:applicationId/final-review')
  application(@Param('applicationId') applicationId: string) {
    return this.finalReview.getApplication(applicationId);
  }

  @Post('applications/:applicationId/final-review/decision')
  @OfficerRoles(OfficerRole.AUTHORIZED_OFFICER, OfficerRole.ADMIN)
  submitDecision(
    @Param('applicationId') applicationId: string,
    @Body() body: Record<string, unknown>,
    @CurrentOfficer() officer: OfficerIdentity,
  ) {
    return this.finalReview.submitDecision(applicationId, body, officer);
  }
}
