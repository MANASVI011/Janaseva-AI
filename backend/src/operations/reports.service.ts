import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import {
  ApplicationDocumentStatus,
  ApplicationWorkflowStage,
} from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { applicationAttentionWhere } from './application-attention.js';
import {
  applicationSqlFilters,
  applicationWhere,
  parseOperationsFilters,
  parsePagination,
} from './operations-query.js';

const csvColumns = [
  'Application ID',
  'Applicant',
  'Village',
  'Service type',
  'Submission date',
  'Application status',
  'Workflow stage',
  'Priority',
  'Assigned officer',
];

type ExportRow = {
  id: string;
  applicantName: string;
  village: string;
  serviceType: string;
  submissionDate: Date;
  status: ApplicationDocumentStatus;
  workflowStage: ApplicationWorkflowStage;
  priority: string;
  assignedOfficer: { name: string } | null;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(query: Record<string, unknown>) {
    const filters = parseOperationsFilters(query);
    const where = applicationWhere(filters);
    const { page, pageSize, skip } = parsePagination(query);
    const [
      total,
      pendingApplications,
      requiresAttention,
      items,
      statuses,
      stages,
      decisions,
      workload,
      officers,
      serviceTypes,
    ] = await Promise.all([
      this.prisma.application.count({ where }),
      this.prisma.application.count({
        where: {
          AND: [
            where,
            { workflowStage: { not: ApplicationWorkflowStage.COMPLETED } },
          ],
        },
      }),
      this.prisma.application.count({
        where: { AND: [where, applicationAttentionWhere] },
      }),
      this.prisma.application.findMany({
        where,
        select: {
          id: true,
          applicantName: true,
          village: true,
          serviceType: true,
          submissionDate: true,
          status: true,
          workflowStage: true,
          priority: true,
          assignedOfficer: { select: { id: true, name: true, role: true } },
        },
        orderBy: [{ submissionDate: 'desc' }, { id: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.application.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.application.groupBy({
        by: ['workflowStage'],
        where,
        _count: { _all: true },
      }),
      this.prisma.application.groupBy({
        by: ['decisionStatus'],
        where: { ...where, decisionStatus: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.application.groupBy({
        by: ['assignedOfficerId'],
        where: filters.officerId
          ? where
          : { ...where, assignedOfficerId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, role: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.application.findMany({
        distinct: ['serviceType'],
        select: { serviceType: true },
        orderBy: { serviceType: 'asc' },
      }),
    ]);

    const workloadIds = workload
      .map((item) => item.assignedOfficerId)
      .filter((id): id is string => id !== null);
    const workloadOfficers = workloadIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: workloadIds } },
          select: { id: true, name: true, role: true },
        })
      : [];
    const officerById = new Map(
      workloadOfficers.map((officer) => [officer.id, officer]),
    );

    const trendConditions = [applicationSqlFilters(filters)];
    if (!filters.fromDate && !filters.toDateExclusive) {
      trendConditions.push(
        Prisma.sql`a."submissionDate" >= ${new Date(Date.now() - 29 * 86_400_000)}`,
      );
    }
    const trendSearchAndDates = Prisma.join(trendConditions, ' AND ');
    const trend = await this.prisma.$queryRaw<
      { date: string; count: number }[]
    >(Prisma.sql`
      SELECT to_char(
        date_trunc('day', a."submissionDate" AT TIME ZONE 'Asia/Kolkata'),
        'YYYY-MM-DD'
      ) AS date, COUNT(*)::int AS count
      FROM "Application" a
      WHERE ${trendSearchAndDates}
      GROUP BY date
      ORDER BY date ASC
    `);

    return {
      summary: {
        totalApplications: total,
        pendingApplications,
        requiresAttention,
        documentReviewPending:
          statuses.find((item) => item.status === 'DOCUMENT_REVIEW_PENDING')
            ?._count._all ?? 0,
        fieldVerification:
          stages.find((item) => item.workflowStage === 'FIELD_VERIFICATION')
            ?._count._all ?? 0,
        completedWorkflow:
          stages.find((item) => item.workflowStage === 'COMPLETED')?._count
            ._all ?? 0,
        applicationDecisions: decisions.reduce(
          (sum, item) => sum + item._count._all,
          0,
        ),
        approvedApplications:
          decisions.find((item) => item.decisionStatus === 'APPROVED')?._count
            ._all ?? 0,
        rejectedApplications:
          decisions.find((item) => item.decisionStatus === 'REJECTED')?._count
            ._all ?? 0,
        returnedApplications:
          decisions.find(
            (item) => item.decisionStatus === 'RETURNED_FOR_CORRECTION',
          )?._count._all ?? 0,
        overdueApplications: null,
      },
      documentStatusBreakdown: statuses.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
      workflowStageBreakdown: stages.map((item) => ({
        workflowStage: item.workflowStage,
        count: item._count._all,
      })),
      officerWorkload: workload.map((item) => ({
        officer: officerById.get(item.assignedOfficerId ?? '') ?? null,
        count: item._count._all,
      })),
      submissionsByDay: trend,
      filters: {
        officers,
        serviceTypes: serviceTypes.map((item) => item.serviceType),
      },
      items: items.map((item) => ({
        ...item,
        assignedOfficer: item.assignedOfficer
          ? {
              id: item.assignedOfficer.id,
              name: item.assignedOfficer.name,
              role: item.assignedOfficer.role,
            }
          : null,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async exportCsv(query: Record<string, unknown>) {
    const where = applicationWhere(parseOperationsFilters(query));
    const rowLimit = 25_000;
    const rows: ExportRow[] = [];
    for (let skip = 0; skip <= rowLimit;) {
      const take = Math.min(500, rowLimit + 1 - skip);
      const batch = await this.prisma.application.findMany({
        where,
        select: {
          id: true,
          applicantName: true,
          village: true,
          serviceType: true,
          submissionDate: true,
          status: true,
          workflowStage: true,
          priority: true,
          assignedOfficer: { select: { name: true } },
        },
        orderBy: [{ submissionDate: 'desc' }, { id: 'asc' }],
        skip,
        take,
      });
      rows.push(...batch);
      skip += batch.length;
      if (batch.length < take) break;
    }
    if (rows.length > rowLimit) {
      throw new PayloadTooLargeException(
        'The filtered export exceeds 25,000 applications. Add filters and try again.',
      );
    }
    return [
      csvColumns,
      ...rows.map((row) => [
        row.id,
        row.applicantName,
        row.village,
        row.serviceType,
        row.submissionDate.toISOString(),
        row.status,
        row.workflowStage,
        row.priority,
        row.assignedOfficer?.name ?? '',
      ]),
    ]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\r\n');
  }
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
