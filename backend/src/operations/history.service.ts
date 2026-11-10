import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  OperationsFilters,
  parseOperationsFilters,
  parsePagination,
} from './operations-query.js';

type ActivityRow = {
  id: string;
  category: 'APPLICATION' | 'DOCUMENT' | 'FIELD';
  applicationId: string;
  applicantName: string;
  village: string;
  action: string;
  occurredAt: Date;
  officerId: string | null;
  officerName: string | null;
  officerRole: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  remarks: string | null;
  details: Record<string, unknown> | null;
  documentId: string | null;
  documentCategory: string | null;
  documentLabel: string | null;
  fieldVerificationId: string | null;
  applicationStatus: string;
  workflowStage: string;
  serviceType: string;
};

const activityCte = Prisma.sql`
  WITH activity AS (
    SELECT
      ('application:' || a."id")::text AS "id",
      'APPLICATION'::text AS "category",
      a."id"::text AS "applicationId",
      a."applicantName"::text AS "applicantName",
      a."village"::text AS "village",
      'APPLICATION_SUBMITTED'::text AS "action",
      a."submissionDate" AS "occurredAt",
      NULL::text AS "officerId",
      NULL::text AS "officerName",
      NULL::text AS "officerRole",
      NULL::text AS "previousStatus",
      NULL::text AS "newStatus",
      NULL::text AS "remarks",
      jsonb_build_object('source', 'application_record') AS "details",
      NULL::text AS "documentId",
      NULL::text AS "documentCategory",
      NULL::text AS "documentLabel",
      NULL::text AS "fieldVerificationId",
      a."status"::text AS "applicationStatus",
      a."workflowStage"::text AS "workflowStage",
      a."serviceType"::text AS "serviceType"
    FROM "Application" a

    UNION ALL

    SELECT
      ad."id"::text,
      'APPLICATION'::text,
      a."id"::text,
      a."applicantName"::text,
      a."village"::text,
      CASE ad."decision"
        WHEN 'APPROVE' THEN 'APPLICATION_APPROVED'
        WHEN 'REJECT' THEN 'APPLICATION_REJECTED'
        ELSE 'APPLICATION_RETURNED_FOR_CORRECTION'
      END::text,
      ad."createdAt",
      u."id"::text,
      u."name"::text,
      u."role"::text,
      ad."previousStatus"::text,
      ad."resultingStatus"::text,
      ad."remarks"::text,
      jsonb_build_object(
        'decision', ad."decision"::text,
        'resultingStatus', ad."resultingStatus"::text,
        'previousWorkflowStage', ad."previousWorkflowStage"::text,
        'newWorkflowStage', ad."newWorkflowStage"::text
      ),
      NULL::text,
      NULL::text,
      NULL::text,
      NULL::text,
      a."status"::text,
      ad."newWorkflowStage"::text,
      a."serviceType"::text
    FROM "ApplicationDecision" ad
    JOIN "Application" a ON a."id" = ad."applicationId"
    JOIN "User" u ON u."id" = ad."officerId"

    UNION ALL

    SELECT
      da."id"::text,
      'DOCUMENT'::text,
      a."id"::text,
      a."applicantName"::text,
      a."village"::text,
      da."action"::text,
      da."timestamp",
      u."id"::text,
      u."name"::text,
      u."role"::text,
      da."previousStatus"::text,
      da."newStatus"::text,
      da."remarks"::text,
      jsonb_build_object(
        'documentId', da."documentId",
        'documentCategory', d."category"::text,
        'documentLabel', d."label"
      ),
      d."id"::text,
      d."category"::text,
      d."label"::text,
      NULL::text,
      a."status"::text,
      a."workflowStage"::text,
      a."serviceType"::text
    FROM "DocumentActivity" da
    JOIN "Application" a ON a."id" = da."applicationId"
    JOIN "User" u ON u."id" = da."officerId"
    LEFT JOIN "ApplicationDocument" d ON d."id" = da."documentId"
    WHERE da."action" <> 'APPLICATION_SUBMITTED'

    UNION ALL

    SELECT
      fa."id"::text,
      'FIELD'::text,
      a."id"::text,
      a."applicantName"::text,
      a."village"::text,
      fa."action"::text,
      fa."timestamp",
      u."id"::text,
      u."name"::text,
      u."role"::text,
      NULL::text,
      NULL::text,
      NULL::text,
      fa."details",
      NULL::text,
      NULL::text,
      NULL::text,
      fa."fieldVerificationId"::text,
      a."status"::text,
      a."workflowStage"::text,
      a."serviceType"::text
    FROM "FieldVerificationActivity" fa
    JOIN "Application" a ON a."id" = fa."applicationId"
    JOIN "User" u ON u."id" = fa."officerId"
  )
`;

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getHistory(query: Record<string, unknown>) {
    const filters = parseOperationsFilters(query);
    const category = parseCategory(query.category);
    const { page, pageSize, skip } = parsePagination(query);
    const where = historySqlFilters(filters, category);

    const [items, countRows, groupedRows] = await Promise.all([
      this.prisma.$queryRaw<ActivityRow[]>(Prisma.sql`
        ${activityCte}
        SELECT * FROM activity
        WHERE ${where}
        ORDER BY "occurredAt" DESC, "id" DESC
        LIMIT ${pageSize}
        OFFSET ${skip}
      `),
      this.prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        ${activityCte}
        SELECT COUNT(*)::int AS total FROM activity
        WHERE ${where}
      `),
      this.prisma.$queryRaw<
        { category: string; action: string; count: number }[]
      >(Prisma.sql`
        ${activityCte}
        SELECT "category", "action", COUNT(*)::int AS count
        FROM activity
        WHERE ${where}
        GROUP BY "category", "action"
      `),
    ]);

    const total = countRows[0]?.total ?? 0;
    const counts = (categoryName: string, actions: string[]) =>
      groupedRows
        .filter(
          (item) =>
            item.category === categoryName && actions.includes(item.action),
        )
        .reduce((sum, item) => sum + item.count, 0);

    return {
      items,
      summary: {
        total,
        applicationSubmissions: counts('APPLICATION', [
          'APPLICATION_SUBMITTED',
        ]),
        documentUploads: counts('DOCUMENT', [
          'DOCUMENT_UPLOADED',
          'DOCUMENT_REPLACED',
        ]),
        documentVerifications: counts('DOCUMENT', ['DOCUMENT_VERIFIED']),
        fieldVisitsScheduled: counts('FIELD', [
          'VISIT_SCHEDULED',
          'VISIT_RESCHEDULED',
        ]),
        fieldReportsSubmitted: counts('FIELD', [
          'FIELD_REPORT_SUBMITTED',
          'FOLLOW_UP_REQUESTED',
        ]),
      },
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async exportCsv(query: Record<string, unknown>) {
    const filters = parseOperationsFilters(query);
    const where = historySqlFilters(filters, parseCategory(query.category));
    const rows: ActivityRow[] = [];
    for (let skip = 0; skip <= 25_000;) {
      const take = Math.min(500, 25_001 - skip);
      const batch = await this.prisma.$queryRaw<ActivityRow[]>(Prisma.sql`
        ${activityCte}
        SELECT * FROM activity
        WHERE ${where}
        ORDER BY "occurredAt" DESC, "id" DESC
        LIMIT ${take}
        OFFSET ${skip}
      `);
      rows.push(...batch);
      skip += batch.length;
      if (batch.length < take) break;
    }
    if (rows.length > 25_000) {
      throw new PayloadTooLargeException(
        'The filtered export exceeds 25,000 activity records. Add filters and try again.',
      );
    }
    return [
      [
        'Application ID',
        'Applicant',
        'Category',
        'Action',
        'Occurred at',
        'Officer',
        'Document',
        'Remarks',
      ],
      ...rows.map((row) => [
        row.applicationId,
        row.applicantName,
        row.category,
        row.action,
        row.occurredAt.toISOString(),
        row.officerName ?? '',
        row.documentLabel ?? '',
        row.remarks ?? '',
      ]),
    ]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\r\n');
  }
}

function parseCategory(value: unknown) {
  if (value === undefined || value === '' || value === 'all') return null;
  if (value === 'APPLICATION' || value === 'DOCUMENT' || value === 'FIELD') {
    return value;
  }
  throw new BadRequestException('Activity category is invalid.');
}

function historySqlFilters(
  filters: OperationsFilters,
  category: string | null,
) {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (filters.fromDate) {
    conditions.push(Prisma.sql`"occurredAt" >= ${filters.fromDate}`);
  }
  if (filters.toDateExclusive) {
    conditions.push(Prisma.sql`"occurredAt" < ${filters.toDateExclusive}`);
  }
  if (filters.status) {
    conditions.push(Prisma.sql`"applicationStatus" = ${filters.status}::text`);
  }
  if (filters.workflowStage) {
    conditions.push(
      Prisma.sql`"workflowStage" = ${filters.workflowStage}::text`,
    );
  }
  if (filters.officerId) {
    conditions.push(Prisma.sql`"officerId" = ${filters.officerId}`);
  }
  if (filters.serviceType) {
    conditions.push(Prisma.sql`"serviceType" = ${filters.serviceType}`);
  }
  if (category) conditions.push(Prisma.sql`"category" = ${category}`);
  if (filters.search) {
    const terms = filters.search.split(/\s+/);
    conditions.push(
      Prisma.sql`${Prisma.join(
        terms.map(
          (term) => Prisma.sql`(
            "applicationId" ILIKE ${`%${term}%`} OR
            "applicantName" ILIKE ${`%${term}%`} OR
            "village" ILIKE ${`%${term}%`} OR
            COALESCE("officerName", '') ILIKE ${`%${term}%`}
          )`,
        ),
        ' AND ',
      )}`,
    );
  }
  return Prisma.join(conditions, ' AND ');
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
