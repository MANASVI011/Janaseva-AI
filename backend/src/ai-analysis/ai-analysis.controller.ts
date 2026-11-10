import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OfficerRole } from '../generated/prisma/enums.js';
import {
  OfficerJwtGuard,
  OfficerRoles,
  OfficerRolesGuard,
} from '../auth/officer-auth.js';
import { AiAnalysisService } from './ai-analysis.service.js';

const allOfficerRoles = [
  OfficerRole.CASEWORKER,
  OfficerRole.VA_RI,
  OfficerRole.AUTHORIZED_OFFICER,
  OfficerRole.ADMIN,
];

@Controller('api')
@UseGuards(OfficerJwtGuard, OfficerRolesGuard)
@OfficerRoles(...allOfficerRoles)
export class AiAnalysisController {
  constructor(private readonly aiAnalysis: AiAnalysisService) {}

  @Get('ai/provider-status')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  providerStatus(@Query('checkConnectivity') checkConnectivity?: string) {
    return this.aiAnalysis.getProviderStatus(checkConnectivity === 'true');
  }

  @Post('applications/:applicationId/ai-analysis')
  analyzeApplication(
    @Param('applicationId') applicationId: string,
    @Body('language') language: unknown,
  ) {
    return this.aiAnalysis.analyzeApplication(applicationId, language);
  }
}
