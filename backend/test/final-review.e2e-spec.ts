import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
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
} from '../src/generated/prisma/enums.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const checklist = [
  'RESIDENTIAL_ADDRESS_CHECKED',
  'RESIDENCE_CONFIRMED',
  'HOUSEHOLD_COMPOSITION_CHECKED',
  'INCOME_INFORMATION_DISCUSSED',
  'INCOME_SOURCES_RECORDED',
  'SUPPORTING_INFORMATION_REVIEWED',
  'APPLICANT_INTERACTION_COMPLETED',
].map((key) => ({ key, status: 'VERIFIED', remarks: '' }));

describe('Final Review API (e2e)', () => {
  let app: INestApplication;
  const record = {
    id: 'INC-E2E-FINAL-1',
    applicantName: 'Synthetic Review Applicant',
    village: 'Synthetic Village',
    submissionDate: new Date('2026-11-10T09:00:00Z'),
    serviceType: 'INCOME_CERTIFICATE',
    status: ApplicationDocumentStatus.DOCUMENTS_VERIFIED,
    decisionStatus: null,
    workflowStage: ApplicationWorkflowStage.FINAL_REVIEW,
    priority: 'NORMAL',
    assignedOfficer: { id: 'demo-caseworker', name: 'Demo caseworker' },
    documents: [
      {
        category: 'IDENTITY_PROOF',
        label: '',
        required: true,
        status: DocumentStatus.VERIFIED,
        versions: [{ status: DocumentStatus.VERIFIED }],
      },
    ],
    fieldVerification: {
      status: FieldVisitStatus.SUBMITTED,
      assignedOfficer: { id: 'demo-va-ri-sagara', name: 'Demo VA / RI' },
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
  };
  const decisionCreate = vi.fn().mockImplementation(({ data }) => ({
    id: 'decision-e2e-1',
    ...data,
    createdAt: new Date('2026-11-10T10:00:00Z'),
    officer: {
      id: 'demo-authorized-officer',
      name: 'Synthetic Demonstration Authorised Officer',
      role: OfficerRole.AUTHORIZED_OFFICER,
    },
  }));
  const prismaMock = {
    user: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        where.id === 'demo-authorized-officer'
          ? {
              id: where.id,
              name: 'Synthetic Demonstration Authorised Officer',
              role: OfficerRole.AUTHORIZED_OFFICER,
              isActive: true,
            }
          : {
              id: where.id,
              name: 'Demo caseworker',
              role: OfficerRole.CASEWORKER,
              isActive: true,
            },
      ),
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'demo-authorized-officer',
          name: 'Synthetic Demonstration Authorised Officer',
          role: OfficerRole.AUTHORIZED_OFFICER,
        },
      ]),
    },
    application: {
      findMany: vi.fn().mockResolvedValue([record]),
      findUnique: vi.fn().mockResolvedValue(record),
      count: vi.fn().mockResolvedValue(1),
    },
    documentRequirement: {
      findMany: vi.fn().mockResolvedValue([
        {
          serviceType: 'INCOME_CERTIFICATE',
          category: 'IDENTITY_PROOF',
          label: '',
          required: true,
        },
      ]),
    },
    $transaction: vi.fn(async (callback: (tx: object) => unknown) =>
      callback({
        application: {
          findUnique: vi.fn().mockResolvedValue(record),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        documentRequirement: {
          findMany: vi.fn().mockResolvedValue([
            {
              category: 'IDENTITY_PROOF',
              label: '',
              required: true,
            },
          ]),
        },
        applicationDecision: { create: decisionCreate },
      }),
    ),
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DOCUMENT_VERIFICATION_DEMO_AUTH_ENABLED = 'true';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the authenticated final-review queue with reviewer identities', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/final-review')
      .set('X-Janaseva-Demo-Auth', 'enabled')
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      id: record.id,
      eligible: true,
      workflowStage: ApplicationWorkflowStage.FINAL_REVIEW,
    });
    expect(response.body.reviewers).toContainEqual(
      expect.objectContaining({ role: OfficerRole.AUTHORIZED_OFFICER }),
    );
  });

  it('denies a caseworker attempting to submit a decision', async () => {
    await request(app.getHttpServer())
      .post(`/api/applications/${record.id}/final-review/decision`)
      .set('X-Janaseva-Demo-Auth', 'enabled')
      .send({ decision: ApplicationDecisionType.APPROVE })
      .expect(403);
  });

  it('persists an explicit authorised officer decision through the API', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/applications/${record.id}/final-review/decision`)
      .set('X-Janaseva-Demo-Auth', 'enabled')
      .set('X-Janaseva-Demo-Review-Officer', 'demo-authorized-officer')
      .send({
        decision: ApplicationDecisionType.REJECT,
        remarks: 'Synthetic e2e rejection reason.',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      decision: {
        decision: ApplicationDecisionType.REJECT,
        resultingStatus: ApplicationDecisionStatus.REJECTED,
        officer: { role: OfficerRole.AUTHORIZED_OFFICER },
      },
      application: {
        id: record.id,
        decisionStatus: ApplicationDecisionStatus.REJECTED,
        workflowStage: ApplicationWorkflowStage.COMPLETED,
      },
    });
    expect(decisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationId: record.id,
          decision: ApplicationDecisionType.REJECT,
        }),
      }),
    );
  });
});
