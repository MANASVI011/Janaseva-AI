import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { OfficerRole } from '../generated/prisma/enums.js';
import {
  CurrentOfficer,
  OfficerJwtGuard,
  OfficerRoles,
  OfficerRolesGuard,
  type OfficerIdentity,
} from '../auth/officer-auth.js';
import { HistoryService } from './history.service.js';
import { ReportsService } from './reports.service.js';

const allOfficerRoles = [
  OfficerRole.CASEWORKER,
  OfficerRole.VA_RI,
  OfficerRole.AUTHORIZED_OFFICER,
  OfficerRole.ADMIN,
];

@Controller('api')
@UseGuards(OfficerJwtGuard, OfficerRolesGuard)
@OfficerRoles(...allOfficerRoles)
export class OperationsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly history: HistoryService,
  ) {}

  @Get('reports')
  getReports(@Query() query: Record<string, unknown>) {
    return this.reports.getReport(query);
  }

  @Get('reports/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="janaseva-reports.csv"')
  exportReports(@Query() query: Record<string, unknown>) {
    return this.reports.exportCsv(query);
  }

  @Get('history')
  getHistory(@Query() query: Record<string, unknown>) {
    return this.history.getHistory(query);
  }

  @Get('history/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="janaseva-history.csv"')
  exportHistory(@Query() query: Record<string, unknown>) {
    return this.history.exportCsv(query);
  }

  @Get('settings/profile')
  getProfile(
    @CurrentOfficer() officer: OfficerIdentity,
    @Req() request: Request,
  ) {
    const isDemo =
      request.headers['x-janaseva-demo-auth'] === 'enabled' &&
      process.env.NODE_ENV !== 'production';
    return {
      officer: {
        id: officer.id,
        name: officer.name,
        role: officer.role,
      },
      account: {
        status: 'ACTIVE',
        authentication: isDemo ? 'DEMONSTRATION' : 'SIGNED_OFFICER_SESSION',
      },
      organization: {
        department: null,
        district: null,
      },
      application: {
        name: 'Janaseva AI',
        version: process.env.APP_VERSION ?? null,
        officialPortal: false,
      },
    };
  }
}
