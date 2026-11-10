import { BadRequestException } from '@nestjs/common';
import {
  ApplicationDocumentStatus,
  ApplicationWorkflowStage,
} from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';

export type OperationsFilters = {
  fromDate: Date | null;
  toDateExclusive: Date | null;
  status: ApplicationDocumentStatus | null;
  workflowStage: ApplicationWorkflowStage | null;
  officerId: string | null;
  serviceType: string | null;
  search: string;
};

const statuses = new Set<string>(Object.values(ApplicationDocumentStatus));
const workflowStages = new Set<string>(Object.values(ApplicationWorkflowStage));

function parseDate(value: unknown, name: string): Date | null {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${name} must be a valid YYYY-MM-DD date.`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    throw new BadRequestException(`${name} must be a valid YYYY-MM-DD date.`);
  }
  return new Date(utcDate.getTime() - 330 * 60_000);
}

export function parseOperationsFilters(
  query: Record<string, unknown>,
): OperationsFilters {
  const fromDate = parseDate(query.fromDate, 'fromDate');
  const toDate = parseDate(query.toDate, 'toDate');
  if (fromDate && toDate && fromDate > toDate) {
    throw new BadRequestException('fromDate must be on or before toDate.');
  }
  if (
    typeof query.status === 'string' &&
    query.status !== 'all' &&
    !statuses.has(query.status)
  ) {
    throw new BadRequestException('Application status is invalid.');
  }
  if (
    typeof query.workflowStage === 'string' &&
    query.workflowStage !== 'all' &&
    !workflowStages.has(query.workflowStage)
  ) {
    throw new BadRequestException('Application workflow stage is invalid.');
  }
  const serviceType =
    typeof query.serviceType === 'string' && query.serviceType !== 'all'
      ? query.serviceType.trim().slice(0, 100)
      : null;
  const officerId =
    typeof query.officerId === 'string' && query.officerId !== 'all'
      ? query.officerId.trim().slice(0, 100)
      : null;
  return {
    fromDate,
    toDateExclusive: toDate
      ? new Date(toDate.getTime() + 24 * 60 * 60_000)
      : null,
    status:
      typeof query.status === 'string' && statuses.has(query.status)
        ? (query.status as ApplicationDocumentStatus)
        : null,
    workflowStage:
      typeof query.workflowStage === 'string' &&
      workflowStages.has(query.workflowStage)
        ? (query.workflowStage as ApplicationWorkflowStage)
        : null,
    officerId,
    serviceType,
    search:
      typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '',
  };
}

export function applicationWhere(
  filters: OperationsFilters,
): Prisma.ApplicationWhereInput {
  const where: Prisma.ApplicationWhereInput = {};
  if (filters.fromDate || filters.toDateExclusive) {
    where.submissionDate = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDateExclusive ? { lt: filters.toDateExclusive } : {}),
    };
  }
  if (filters.status) where.status = filters.status;
  if (filters.workflowStage) where.workflowStage = filters.workflowStage;
  if (filters.officerId) where.assignedOfficerId = filters.officerId;
  if (filters.serviceType) where.serviceType = filters.serviceType;
  if (filters.search) {
    where.AND = filters.search.split(/\s+/).map((term) => ({
      OR: [
        { id: { contains: term, mode: 'insensitive' } },
        { applicantName: { contains: term, mode: 'insensitive' } },
        { village: { contains: term, mode: 'insensitive' } },
      ],
    }));
  }
  return where;
}

export function applicationSqlFilters(filters: OperationsFilters) {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (filters.fromDate) {
    conditions.push(Prisma.sql`a."submissionDate" >= ${filters.fromDate}`);
  }
  if (filters.toDateExclusive) {
    conditions.push(
      Prisma.sql`a."submissionDate" < ${filters.toDateExclusive}`,
    );
  }
  if (filters.status) {
    conditions.push(
      Prisma.sql`a."status" = ${filters.status}::"ApplicationDocumentStatus"`,
    );
  }
  if (filters.workflowStage) {
    conditions.push(
      Prisma.sql`a."workflowStage" = ${filters.workflowStage}::"ApplicationWorkflowStage"`,
    );
  }
  if (filters.officerId) {
    conditions.push(Prisma.sql`a."assignedOfficerId" = ${filters.officerId}`);
  }
  if (filters.serviceType) {
    conditions.push(Prisma.sql`a."serviceType" = ${filters.serviceType}`);
  }
  if (filters.search) {
    const terms = filters.search.split(/\s+/);
    conditions.push(
      Prisma.sql`${Prisma.join(
        terms.map(
          (term) => Prisma.sql`(
            a."id" ILIKE ${`%${term}%`} OR
            a."applicantName" ILIKE ${`%${term}%`} OR
            a."village" ILIKE ${`%${term}%`}
          )`,
        ),
        ' AND ',
      )}`,
    );
  }
  return Prisma.join(conditions, ' AND ');
}

export function parsePagination(query: Record<string, unknown>) {
  const page = parsePositiveInteger(query.page, 1, 100_000, 'page');
  const pageSize = parsePositiveInteger(query.pageSize, 20, 100, 'pageSize');
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  maximum: number,
  name: string,
) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new BadRequestException(
      `${name} must be an integer between 1 and ${maximum}.`,
    );
  }
  return parsed;
}
