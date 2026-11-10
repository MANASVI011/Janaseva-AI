import { BadRequestException } from '@nestjs/common';
import { vi } from 'vitest';
import {
  DocumentStatus,
  FieldVerificationOutcome,
  FieldVisitStatus,
  OfficerRole,
} from '../generated/prisma/enums.js';
import type { OfficerIdentity } from '../auth/officer-auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FieldVerificationService } from './field-verification.service.js';

const officer: OfficerIdentity = {
  id: 'demo-caseworker',
  role: OfficerRole.CASEWORKER,
  name: 'Demo caseworker',
};

const checklist = [
  'RESIDENTIAL_ADDRESS_CHECKED',
  'RESIDENCE_CONFIRMED',
  'HOUSEHOLD_COMPOSITION_CHECKED',
  'INCOME_INFORMATION_DISCUSSED',
  'INCOME_SOURCES_RECORDED',
  'SUPPORTING_INFORMATION_REVIEWED',
  'APPLICANT_INTERACTION_COMPLETED',
].map((key) => ({ key, status: 'VERIFIED', remarks: '' }));

function application() {
  return {
    id: 'INC-TEST-1',
    serviceType: 'INCOME_CERTIFICATE',
    documents: [
      {
        category: 'IDENTITY_PROOF',
        label: '',
        versions: [{ status: DocumentStatus.VERIFIED }],
      },
    ],
  };
}

function prismaMock(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'demo-va-ri-sagara',
        name: 'Synthetic Demonstration VA / RI 01',
        role: OfficerRole.VA_RI,
      }),
      findMany: vi.fn().mockResolvedValue([]),
      ...((overrides.user ?? {}) as object),
    },
    application: {
      findUnique: vi.fn().mockResolvedValue(application()),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
      ...((overrides.application ?? {}) as object),
    },
    documentRequirement: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ category: 'IDENTITY_PROOF', label: '' }]),
      ...((overrides.documentRequirement ?? {}) as object),
    },
    fieldVerification: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
      ...((overrides.fieldVerification ?? {}) as object),
    },
    fieldVerificationActivity: {
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      ...((overrides.fieldVerificationActivity ?? {}) as object),
    },
    $transaction:
      overrides.$transaction ??
      vi.fn(async (callback: (tx: unknown) => unknown) =>
        callback({
          fieldVerification: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            findUniqueOrThrow: vi.fn(),
          },
          fieldVerificationActivity: { create: vi.fn() },
          application: { update: vi.fn() },
        }),
      ),
  } as unknown as PrismaService;
}

describe('FieldVerificationService', () => {
  it('labels assistant output as demonstration-only and identifies incomplete checklist items', () => {
    const service = new FieldVerificationService(prismaMock());
    const result = service.assist({
      observations: 'Applicant was not at the listed address.',
      checklist: [
        {
          key: 'RESIDENCE_CONFIRMED',
          status: 'UNABLE_TO_VERIFY',
          remarks: '',
        },
      ],
    });

    expect(result.mode).toBe('DEMONSTRATION');
    expect(result.statementsForClarification).toEqual(['RESIDENCE_CONFIRMED']);
    expect(result.incompleteItems).toContain('RESIDENTIAL_ADDRESS_CHECKED');
    expect(result.notice).toContain('advisory only');
  });

  it('blocks scheduling when a required document is not verified', async () => {
    const db = prismaMock({
      application: {
        findUnique: vi.fn().mockResolvedValue({
          ...application(),
          documents: [],
        }),
      },
    });
    const service = new FieldVerificationService(db);

    await expect(
      service.schedule(
        'INC-TEST-1',
        {
          scheduledAt: '2027-01-15T10:00',
          village: 'Hulikallu',
          address: 'Model Road',
        },
        officer,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.fieldVerification.findUnique).not.toHaveBeenCalled();
  });

  it('does not create another activity when assigning the same officer', async () => {
    const previous = {
      id: 'field-1',
      applicationId: 'INC-TEST-1',
      assignedOfficerId: 'demo-va-ri-sagara',
      status: FieldVisitStatus.NOT_SCHEDULED,
    };
    const activityCreate = vi.fn();
    const transaction = vi.fn();
    const db = prismaMock({
      fieldVerification: {
        findUnique: vi.fn().mockResolvedValue(previous),
      },
      fieldVerificationActivity: { create: activityCreate },
      $transaction: transaction,
    });
    const service = new FieldVerificationService(db);

    await expect(
      service.assign(
        'INC-TEST-1',
        { assignedOfficerId: 'demo-va-ri-sagara' },
        officer,
      ),
    ).resolves.toMatchObject({
      ...previous,
      assignedOfficer: {
        id: 'demo-va-ri-sagara',
        name: 'Synthetic Demonstration VA / RI 01',
        role: OfficerRole.VA_RI,
      },
      application: 'INC-TEST-1',
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it('includes applications without a visit in the not-scheduled filter', async () => {
    const applicationWithoutVisit = {
      ...application(),
      applicantName: 'Synthetic Applicant',
      fieldVerification: null,
    };
    const findMany = vi.fn().mockResolvedValue([applicationWithoutVisit]);
    const db = prismaMock({
      application: {
        findMany,
        count: vi.fn().mockResolvedValue(1),
      },
    });
    const service = new FieldVerificationService(db);

    const result = await service.listQueue({
      visitStatus: FieldVisitStatus.NOT_SCHEDULED,
      search: 'Synthetic',
    });
    const where = findMany.mock.calls[0]?.[0].where;

    expect(where).toMatchObject({
      AND: [
        {
          OR: expect.arrayContaining([
            expect.objectContaining({
              applicantName: {
                contains: 'Synthetic',
                mode: 'insensitive',
              },
            }),
          ]),
        },
        {
          OR: expect.arrayContaining([{ fieldVerification: { is: null } }]),
        },
      ],
    });
    expect(result.items[0]?.visitStatus).toBe(FieldVisitStatus.NOT_SCHEDULED);
  });

  it('rejects invalid calendar dates for a field visit', async () => {
    const db = prismaMock({
      fieldVerification: {
        findUnique: vi.fn().mockResolvedValue({
          assignedOfficerId: 'demo-va-ri-sagara',
          assignedById: officer.id,
          scheduledAt: null,
          status: FieldVisitStatus.NOT_SCHEDULED,
        }),
      },
    });
    const service = new FieldVerificationService(db);

    await expect(
      service.schedule(
        'INC-TEST-1',
        {
          scheduledAt: '2027-02-31T10:00',
          village: 'Hulikallu',
          address: 'Model Road',
        },
        officer,
      ),
    ).rejects.toThrow('Enter a valid visit date and time.');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('persists an assigned officer report draft before scheduling', async () => {
    const savedDraft = { id: 'field-1', status: FieldVisitStatus.DRAFT };
    const update = vi.fn().mockResolvedValue(savedDraft);
    const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        fieldVerification: { update },
        fieldVerificationActivity: { create: vi.fn() },
      }),
    );
    const db = prismaMock({
      fieldVerification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'field-1',
          applicationId: 'INC-TEST-1',
          assignedOfficerId: 'demo-va-ri-sagara',
          scheduledAt: null,
          status: FieldVisitStatus.NOT_SCHEDULED,
        }),
      },
      $transaction: transaction,
    });
    const service = new FieldVerificationService(db);
    const fieldOfficer: OfficerIdentity = {
      id: 'demo-va-ri-sagara',
      role: OfficerRole.VA_RI,
      name: 'Demo VA / RI',
    };

    await expect(
      service.saveDraft(
        'field-1',
        {
          checklist: [
            {
              key: 'RESIDENCE_CONFIRMED',
              status: 'VERIFIED',
              remarks: 'Officer entered field note.',
            },
          ],
          observations: 'Draft observation.',
          outcome: FieldVerificationOutcome.INFORMATION_SUPPORTED,
          remarks: '',
          followUpRequested: true,
        },
        fieldOfficer,
      ),
    ).resolves.toEqual(savedDraft);
    expect(update.mock.calls[0]?.[0].data).toMatchObject({
      checklist: [
        {
          key: 'RESIDENCE_CONFIRMED',
          status: 'VERIFIED',
          remarks: 'Officer entered field note.',
        },
      ],
      observations: 'Draft observation.',
      followUpRequested: true,
      status: FieldVisitStatus.DRAFT,
    });
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('starts an eligible scheduled report draft after its appointment time', async () => {
    const updated = {
      id: 'field-1',
      status: FieldVisitStatus.IN_PROGRESS,
    };
    const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        fieldVerification: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue(updated),
        },
        fieldVerificationActivity: { create: vi.fn() },
      }),
    );
    const db = prismaMock({
      fieldVerification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'field-1',
          applicationId: 'INC-TEST-1',
          assignedOfficerId: 'demo-va-ri-sagara',
          scheduledAt: new Date(Date.now() - 60_000),
          status: FieldVisitStatus.DRAFT,
        }),
      },
      $transaction: transaction,
    });
    const service = new FieldVerificationService(db);
    const fieldOfficer: OfficerIdentity = {
      id: 'demo-va-ri-sagara',
      role: OfficerRole.VA_RI,
      name: 'Demo VA / RI',
    };

    await expect(service.startVisit('field-1', fieldOfficer)).resolves.toEqual(
      updated,
    );
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('requires a visit to be started before submitting its report', async () => {
    const db = prismaMock({
      fieldVerification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'field-1',
          applicationId: 'INC-TEST-1',
          assignedOfficerId: 'demo-va-ri-sagara',
          scheduledAt: new Date(Date.now() - 60_000),
          status: FieldVisitStatus.SCHEDULED,
        }),
      },
    });
    const service = new FieldVerificationService(db);
    const fieldOfficer: OfficerIdentity = {
      id: 'demo-va-ri-sagara',
      role: OfficerRole.VA_RI,
      name: 'Demo VA / RI',
    };

    await expect(
      service.submitReport(
        'field-1',
        {
          checklist,
          observations: 'Address and household information checked.',
          outcome: FieldVerificationOutcome.INFORMATION_SUPPORTED,
        },
        fieldOfficer,
      ),
    ).rejects.toThrow(
      'Start the scheduled field visit before submitting its report.',
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('submits a saved draft when its visit was previously started', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const submitted = {
      id: 'field-1',
      status: FieldVisitStatus.SUBMITTED,
      submittedAt: new Date(),
    };
    const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        fieldVerification: {
          updateMany,
          findUniqueOrThrow: vi.fn().mockResolvedValue(submitted),
        },
        fieldVerificationActivity: { create: vi.fn() },
        application: { update: vi.fn() },
      }),
    );
    const db = prismaMock({
      fieldVerification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'field-1',
          applicationId: 'INC-TEST-1',
          assignedOfficerId: 'demo-va-ri-sagara',
          scheduledAt: new Date(Date.now() - 60_000),
          status: FieldVisitStatus.DRAFT,
        }),
      },
      fieldVerificationActivity: {
        findFirst: vi.fn().mockResolvedValue({ id: 'visit-started' }),
      },
      $transaction: transaction,
    });
    const service = new FieldVerificationService(db);
    const fieldOfficer: OfficerIdentity = {
      id: 'demo-va-ri-sagara',
      role: OfficerRole.VA_RI,
      name: 'Demo VA / RI',
    };

    await expect(
      service.submitReport(
        'field-1',
        {
          checklist,
          observations: 'Address and household information checked.',
          outcome: FieldVerificationOutcome.INFORMATION_SUPPORTED,
        },
        fieldOfficer,
      ),
    ).resolves.toEqual(submitted);
    expect(db.fieldVerificationActivity.findFirst).toHaveBeenCalledWith({
      where: {
        fieldVerificationId: 'field-1',
        action: 'VISIT_STARTED',
      },
      select: { id: true },
    });
    expect(updateMany.mock.calls[0]?.[0].where.status.in).toContain(
      FieldVisitStatus.DRAFT,
    );
  });

  it('keeps follow-up reports in field verification instead of final review', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const applicationUpdate = vi.fn();
    const followUpRecord = {
      id: 'field-1',
      status: FieldVisitStatus.FOLLOW_UP,
      followUpRequested: true,
    };
    const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        fieldVerification: {
          updateMany,
          findUniqueOrThrow: vi.fn().mockResolvedValue(followUpRecord),
        },
        fieldVerificationActivity: { create: vi.fn() },
        application: { update: applicationUpdate },
      }),
    );
    const db = prismaMock({
      fieldVerification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'field-1',
          applicationId: 'INC-TEST-1',
          assignedOfficerId: 'demo-va-ri-sagara',
          scheduledAt: new Date(Date.now() - 60_000),
          status: FieldVisitStatus.IN_PROGRESS,
        }),
      },
      $transaction: transaction,
    });
    const service = new FieldVerificationService(db);
    const fieldOfficer: OfficerIdentity = {
      id: 'demo-va-ri-sagara',
      role: OfficerRole.VA_RI,
      name: 'Demo VA / RI',
    };

    await expect(
      service.submitReport(
        'field-1',
        {
          checklist,
          observations: 'Further information is needed.',
          outcome: FieldVerificationOutcome.FURTHER_VERIFICATION_REQUIRED,
          remarks: 'Verify the other household income source.',
        },
        fieldOfficer,
      ),
    ).resolves.toEqual(followUpRecord);
    expect(updateMany.mock.calls[0]?.[0].data).toMatchObject({
      status: FieldVisitStatus.FOLLOW_UP,
      followUpRequested: true,
    });
    expect(applicationUpdate).not.toHaveBeenCalled();
  });

  it('moves a submitted field report to final review', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const applicationUpdate = vi.fn();
    const submittedRecord = {
      id: 'field-1',
      status: FieldVisitStatus.SUBMITTED,
      followUpRequested: false,
    };
    const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        fieldVerification: {
          updateMany,
          findUniqueOrThrow: vi.fn().mockResolvedValue(submittedRecord),
        },
        fieldVerificationActivity: { create: vi.fn() },
        application: { update: applicationUpdate },
      }),
    );
    const db = prismaMock({
      fieldVerification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'field-1',
          applicationId: 'INC-TEST-1',
          assignedOfficerId: 'demo-va-ri-sagara',
          scheduledAt: new Date(Date.now() - 60_000),
          status: FieldVisitStatus.IN_PROGRESS,
        }),
      },
      $transaction: transaction,
    });
    const service = new FieldVerificationService(db);
    const fieldOfficer: OfficerIdentity = {
      id: 'demo-va-ri-sagara',
      role: OfficerRole.VA_RI,
      name: 'Demo VA / RI',
    };

    await expect(
      service.submitReport(
        'field-1',
        {
          checklist,
          observations: 'Address and household information checked.',
          outcome: FieldVerificationOutcome.INFORMATION_SUPPORTED,
        },
        fieldOfficer,
      ),
    ).resolves.toEqual(submittedRecord);
    expect(updateMany.mock.calls[0]?.[0].data).toMatchObject({
      status: FieldVisitStatus.SUBMITTED,
    });
    expect(applicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { workflowStage: 'FINAL_REVIEW' },
      }),
    );
  });

  it('does not duplicate a report after another request has already submitted it', async () => {
    const db = prismaMock({
      fieldVerification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'field-1',
          applicationId: 'INC-TEST-1',
          assignedOfficerId: 'demo-va-ri-sagara',
          scheduledAt: new Date(Date.now() - 60_000),
          status: FieldVisitStatus.IN_PROGRESS,
        }),
      },
    });
    const fieldOfficer: OfficerIdentity = {
      id: 'demo-va-ri-sagara',
      role: OfficerRole.VA_RI,
      name: 'Demo VA / RI',
    };
    const service = new FieldVerificationService(db);

    await expect(
      service.submitReport(
        'field-1',
        {
          checklist,
          observations: 'Address and household information checked.',
          outcome: FieldVerificationOutcome.INFORMATION_SUPPORTED,
        },
        fieldOfficer,
      ),
    ).rejects.toThrow('This field report has already been submitted.');
    expect(db.$transaction).toHaveBeenCalledOnce();
  });
});
