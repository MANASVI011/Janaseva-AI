import { BadRequestException } from '@nestjs/common';
import {
  ApplicationDocumentStatus,
  ApplicationWorkflowStage,
} from '../generated/prisma/enums.js';
import {
  applicationWhere,
  parseOperationsFilters,
  parsePagination,
} from './operations-query.js';

describe('operations query validation', () => {
  it('parses inclusive local-calendar date filters and supported application filters', () => {
    const filters = parseOperationsFilters({
      fromDate: '2025-01-01',
      toDate: '2025-01-02',
      status: ApplicationDocumentStatus.DOCUMENTS_VERIFIED,
      workflowStage: ApplicationWorkflowStage.FINAL_REVIEW,
      officerId: 'officer-1',
      serviceType: 'INCOME_CERTIFICATE',
      search: '  Anu  Halli ',
    });

    expect(filters.fromDate?.toISOString()).toBe('2024-12-31T18:30:00.000Z');
    expect(filters.toDateExclusive?.toISOString()).toBe(
      '2025-01-02T18:30:00.000Z',
    );
    expect(filters.status).toBe(ApplicationDocumentStatus.DOCUMENTS_VERIFIED);
    expect(filters.workflowStage).toBe(ApplicationWorkflowStage.FINAL_REVIEW);
    expect(filters.search).toBe('Anu  Halli');
  });

  it('rejects invalid dates, reversed ranges, and unsupported enum values', () => {
    expect(() => parseOperationsFilters({ fromDate: '2025-02-30' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      parseOperationsFilters({
        fromDate: '2025-02-02',
        toDate: '2025-02-01',
      }),
    ).toThrow(BadRequestException);
    expect(() => parseOperationsFilters({ status: 'APPROVED' })).toThrow(
      BadRequestException,
    );
  });

  it('builds safe Prisma filters and bounds pagination', () => {
    const filters = parseOperationsFilters({
      search: 'Asha 123',
      status: ApplicationDocumentStatus.DOCUMENT_REVIEW_PENDING,
      officerId: 'officer-1',
    });
    expect(applicationWhere(filters)).toMatchObject({
      status: ApplicationDocumentStatus.DOCUMENT_REVIEW_PENDING,
      assignedOfficerId: 'officer-1',
      AND: [{ OR: expect.any(Array) }, { OR: expect.any(Array) }],
    });
    expect(parsePagination({ page: '2', pageSize: '50' })).toEqual({
      page: 2,
      pageSize: 50,
      skip: 50,
    });
    expect(() => parsePagination({ pageSize: '101' })).toThrow(
      BadRequestException,
    );
  });
});
