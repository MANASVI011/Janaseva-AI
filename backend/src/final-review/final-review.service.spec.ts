import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { vi } from 'vitest';
import {
  ApplicationDecisionStatus,
  ApplicationDecisionType,
  ApplicationDocumentStatus,
  ApplicationWorkflowStage,
  DocumentStatus,
  FieldVerificationOutcome,
  FieldVisitStatus,
  OfficerRole,
} from '../generated/prisma/enums.js';
import type { OfficerIdentity } from '../auth/officer-auth.js';
import { OfficerRolesGuard } from '../auth/officer-auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FinalReviewController } from './final-review.controller.js';
import { FinalReviewService } from './final-review.service.js';

const officer: OfficerIdentity = {
  id: 'demo-authorized-officer',
  role: OfficerRole.AUTHORIZED_OFFICER,
  name: 'Demo authorised officer',
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

function eligibleApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: 'INC-TEST-FINAL-1',
    applicantName: 'Synthetic Applicant',
    village: 'Synthetic Village',
    submissionDate: new Date('2026-11-10T09:00:00Z'),
    serviceType: 'INCOME_CERTIFICATE',
    status: ApplicationDocumentStatus.DOCUMENTS_VERIFIED,
    decisionStatus: null,
    workflowStage: ApplicationWorkflowStage.FINAL_REVIEW,
    priority: 'NORMAL',
    assignedOfficer: {
      id: 'caseworker',
      name: 'Caseworker',
      role: 'CASEWORKER',
    },
    documents: [
      {
        category: 'IDENTITY_PROOF',
        label: '',
        status: DocumentStatus.VERIFIED,
        versions: [{ status: DocumentStatus.VERIFIED }],
      },
    ],
    fieldVerification: {
      status: FieldVisitStatus.SUBMITTED,
      submittedAt: new Date('2026-11-09T12:00:00Z'),
      outcome: FieldVerificationOutcome.INFORMATION_SUPPORTED,
      followUpRequested: false,
      checklist,
    },
    missingRequests: [],
    decisions: [],
    hobli: 'Synthetic Hobli',
    taluk: 'Synthetic Taluk',
    district: 'Synthetic District',
    address: 'Synthetic Address',
    annualFamilyIncome: 100000,
    applicationPurpose: 'Income certificate',
    ...overrides,
  };
}

function prismaMock(
  options: {
    application?: ReturnType<typeof eligibleApplication>;
    transitionCount?: number;
    createDecision?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const application = options.application ?? eligibleApplication();
  const updateMany = vi
    .fn()
    .mockResolvedValue({ count: options.transitionCount ?? 1 });
  const createDecision =
    options.createDecision ??
    vi.fn().mockImplementation(async ({ data }) => ({
      id: 'decision-1',
      ...data,
      createdAt: new Date('2026-11-10T10:00:00Z'),
      officer,
    }));
  const transactionClient = {
    application: {
      findUnique: vi.fn().mockResolvedValue(application),
      updateMany,
    },
    documentRequirement: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { category: 'IDENTITY_PROOF', label: '', required: true },
        ]),
    },
    applicationDecision: { create: createDecision },
  };
  const transaction = vi.fn(
    async (callback: (tx: typeof transactionClient) => unknown) =>
      callback(transactionClient),
  );
  const prisma = {
    application: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(application),
      count: vi.fn().mockResolvedValue(0),
    },
    documentRequirement: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: transaction,
  } as unknown as PrismaService;
  return { prisma, transaction, transactionClient, updateMany, createDecision };
}

describe('FinalReviewService', () => {
  it.each([
    [
      ApplicationDecisionType.APPROVE,
      ApplicationDecisionStatus.APPROVED,
      ApplicationWorkflowStage.COMPLETED,
      undefined,
    ],
    [
      ApplicationDecisionType.REJECT,
      ApplicationDecisionStatus.REJECTED,
      ApplicationWorkflowStage.COMPLETED,
      'Reason for rejection',
    ],
    [
      ApplicationDecisionType.RETURN_FOR_CORRECTION,
      ApplicationDecisionStatus.RETURNED_FOR_CORRECTION,
      ApplicationWorkflowStage.DOCUMENT_VERIFICATION,
      'Please correct the listed information.',
    ],
  ])(
    'persists the %s decision and applies its workflow transition',
    async (decision, expectedStatus, expectedStage, remarks) => {
      const { prisma, updateMany, createDecision } = prismaMock();
      const service = new FinalReviewService(prisma);

      const result = await service.submitDecision(
        'INC-TEST-FINAL-1',
        { decision, ...(remarks ? { remarks } : {}) },
        officer,
      );

      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: 'INC-TEST-FINAL-1',
          workflowStage: ApplicationWorkflowStage.FINAL_REVIEW,
        },
        data: {
          decisionStatus: expectedStatus,
          workflowStage: expectedStage,
        },
      });
      expect(createDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            applicationId: 'INC-TEST-FINAL-1',
            officerId: officer.id,
            decision,
            resultingStatus: expectedStatus,
            previousWorkflowStage: ApplicationWorkflowStage.FINAL_REVIEW,
            newWorkflowStage: expectedStage,
            remarks: remarks ?? null,
          }),
        }),
      );
      expect(result.application).toMatchObject({
        decisionStatus: expectedStatus,
        workflowStage: expectedStage,
      });
    },
  );

  it('requires remarks for rejection and return-for-correction', async () => {
    const { prisma, transaction } = prismaMock();
    const service = new FinalReviewService(prisma);

    await expect(
      service.submitDecision(
        'INC-TEST-FINAL-1',
        { decision: ApplicationDecisionType.REJECT },
        officer,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.submitDecision(
        'INC-TEST-FINAL-1',
        {
          decision: ApplicationDecisionType.RETURN_FOR_CORRECTION,
          remarks: '  ',
        },
        officer,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid decision values', async () => {
    const { prisma, transaction } = prismaMock();
    const service = new FinalReviewService(prisma);

    await expect(
      service.submitDecision(
        'INC-TEST-FINAL-1',
        { decision: 'AUTOMATIC_APPROVAL' },
        officer,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects a malformed request body', async () => {
    const { prisma, transaction } = prismaMock();
    const service = new FinalReviewService(prisma);

    await expect(
      service.submitDecision('INC-TEST-FINAL-1', null, officer),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects an application outside final review', async () => {
    const { prisma, transaction, updateMany } = prismaMock({
      application: eligibleApplication({
        workflowStage: ApplicationWorkflowStage.FIELD_VERIFICATION,
      }),
    });
    const service = new FinalReviewService(prisma);

    await expect(
      service.submitDecision(
        'INC-TEST-FINAL-1',
        { decision: ApplicationDecisionType.APPROVE },
        officer,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('blocks decisions when required documents are not verified', async () => {
    const { prisma } = prismaMock({
      application: eligibleApplication({
        documents: [
          {
            category: 'IDENTITY_PROOF',
            label: '',
            status: DocumentStatus.PENDING_VERIFICATION,
            versions: [{ status: DocumentStatus.PENDING_VERIFICATION }],
          },
        ],
      }),
    });
    const service = new FinalReviewService(prisma);

    await expect(
      service.submitDecision(
        'INC-TEST-FINAL-1',
        { decision: ApplicationDecisionType.APPROVE },
        officer,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks decisions when field verification is incomplete or requires follow-up', async () => {
    const { prisma } = prismaMock({
      application: eligibleApplication({
        fieldVerification: {
          ...eligibleApplication().fieldVerification,
          status: FieldVisitStatus.FOLLOW_UP,
          outcome: FieldVerificationOutcome.FURTHER_VERIFICATION_REQUIRED,
          followUpRequested: true,
        },
      }),
    });
    const service = new FinalReviewService(prisma);

    await expect(
      service.submitDecision(
        'INC-TEST-FINAL-1',
        { decision: ApplicationDecisionType.APPROVE },
        officer,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate submissions after the conditional stage transition loses a race', async () => {
    const { prisma, createDecision } = prismaMock({ transitionCount: 0 });
    const service = new FinalReviewService(prisma);

    await expect(
      service.submitDecision(
        'INC-TEST-FINAL-1',
        { decision: ApplicationDecisionType.APPROVE },
        officer,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(createDecision).not.toHaveBeenCalled();
  });

  it('keeps the status transition and append-only decision write in one transaction', async () => {
    const createDecision = vi
      .fn()
      .mockRejectedValue(new Error('database write failed'));
    const { prisma, transaction, updateMany } = prismaMock({ createDecision });
    const service = new FinalReviewService(prisma);

    await expect(
      service.submitDecision(
        'INC-TEST-FINAL-1',
        { decision: ApplicationDecisionType.APPROVE },
        officer,
      ),
    ).rejects.toThrow('database write failed');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(createDecision).toHaveBeenCalledTimes(1);
  });

  it('requires an authorised officer role on the decision endpoint', () => {
    const controller = new FinalReviewController(
      new FinalReviewService(prismaMock().prisma),
    );
    const guard = new OfficerRolesGuard({
      getAllAndOverride: () => [
        OfficerRole.AUTHORIZED_OFFICER,
        OfficerRole.ADMIN,
      ],
    } as unknown as Reflector);
    const context = {
      getHandler: () => controller.submitDecision,
      getClass: () => FinalReviewController,
      switchToHttp: () => ({
        getRequest: () => ({
          officer: {
            id: 'demo-caseworker',
            role: OfficerRole.CASEWORKER,
            name: 'Demo caseworker',
          },
        }),
      }),
    };

    expect(() => guard.canActivate(context as never)).toThrow(
      ForbiddenException,
    );
  });
});
