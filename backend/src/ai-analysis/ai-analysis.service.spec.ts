import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { AiAnalysisService } from './ai-analysis.service.js';

const sampleApplication = {
  id: 'SYNTHETIC-REF-001',
  applicantName: 'Synthetic Applicant',
  village: 'Synthetic Village',
  address: '14 Synthetic Road',
  serviceType: 'INCOME_CERTIFICATE',
  applicationPurpose: 'Synthetic Applicant seeks help; phone 9876543210.',
  status: 'DOCUMENTS_VERIFIED',
  workflowStage: 'FINAL_REVIEW',
  documents: [
    {
      category: 'INCOME_DECLARATION',
      label: 'Income declaration',
      required: true,
      status: 'VERIFIED',
      versions: [{ status: 'VERIFIED' }],
    },
  ],
  missingRequests: [],
  fieldVerification: {
    status: 'SUBMITTED',
    outcome: 'INFORMATION_SUPPORTED',
    observations:
      'Synthetic Applicant confirmed residence at 14 Synthetic Road. Phone 9876543210, Aadhaar 1234 5678 9012.',
    checklist: [
      {
        key: 'RESIDENCE_CONFIRMED',
        status: 'VERIFIED',
        remarks: 'private note',
      },
    ],
    reportRemarks: 'Follow up with applicant@example.test',
    followUpRequested: false,
    visitAddress: '14 Synthetic Road',
  },
};

function createService(
  options: {
    application?: typeof sampleApplication | null;
    requirements?: { category: string; label: string }[];
    internalToken?: string | null;
  } = {},
) {
  const application =
    'application' in options ? options.application : sampleApplication;
  const applicationFindUnique = vi.fn().mockResolvedValue(application);
  const requirementFindMany = vi
    .fn()
    .mockResolvedValue(options.requirements ?? []);
  const prisma = {
    application: { findUnique: applicationFindUnique },
    documentRequirement: { findMany: requirementFindMany },
  } as unknown as PrismaService;
  const config = {
    get: vi
      .fn()
      .mockImplementation((key: string) =>
        key === 'AI_SERVICE_URL'
          ? 'http://127.0.0.1:8000'
          : key === 'AI_SERVICE_TOKEN'
            ? options.internalToken === undefined
              ? 'synthetic-internal-token'
              : options.internalToken
            : undefined,
      ),
  } as unknown as ConfigService;
  return {
    service: new AiAnalysisService(prisma, config),
    applicationFindUnique,
    requirementFindMany,
  };
}

describe('AiAnalysisService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retrieves the actual application and sends only redacted analysis fields', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          summary: 'Synthetic summary',
          missingInformation: [],
          potentialInconsistencies: [],
          documentObservations: [],
          fieldVerificationObservations: [],
          suggestedQuestions: [],
          officerAttentionPoints: [],
          disclaimer:
            'AI-generated assistance is advisory only. The authorized officer must independently verify all findings and make the final decision.',
          decision: 'APPROVED',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const { service, applicationFindUnique } = createService();

    const analysis = await service.analyzeApplication(
      'SYNTHETIC-REF-001',
      'en',
    );

    expect(applicationFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'SYNTHETIC-REF-001' },
        include: expect.objectContaining({
          documents: expect.any(Object),
          fieldVerification: expect.any(Object),
        }),
      }),
    );
    const outgoing = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(outgoing.applicationReferenceId).toBe(
      'INCOME_CERTIFICATE_APPLICATION',
    );
    expect(JSON.stringify(outgoing)).not.toContain('SYNTHETIC-REF-001');
    expect(outgoing.documents[0]).toMatchObject({
      name: 'Income declaration',
      documentType: 'INCOME_DECLARATION',
      verificationStatus: 'VERIFIED',
    });
    expect(analysis).not.toHaveProperty('decision');
    expect(JSON.stringify(outgoing)).not.toContain('Synthetic Applicant');
    expect(JSON.stringify(outgoing)).not.toContain('14 Synthetic Road');
    expect(JSON.stringify(outgoing)).not.toContain('9876543210');
    expect(JSON.stringify(outgoing)).not.toContain('1234 5678 9012');
    expect(JSON.stringify(outgoing)).not.toContain('applicant@example.test');
    expect(JSON.stringify(outgoing)).not.toContain('Synthetic Applicant');
    expect(JSON.stringify(outgoing)).not.toContain('private note');
  });

  it('reports an application not found in the shared database', async () => {
    const { service } = createService({ application: null });

    await expect(
      service.analyzeApplication('NOT-FOUND', 'en'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects unsupported analysis languages', async () => {
    const { service } = createService();

    await expect(
      service.analyzeApplication('SYNTHETIC-REF-001', 'fr'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects analysis when the database record contains no analyzable data', async () => {
    const emptyApplication = {
      ...sampleApplication,
      documents: [],
      fieldVerification: null,
    };
    const { service } = createService({
      application: emptyApplication as unknown as typeof sampleApplication,
    });

    await expect(
      service.analyzeApplication('SYNTHETIC-REF-001', 'en'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid AI service response instead of returning fake analysis', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ summary: 'Only a summary' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const { service } = createService();

    await expect(
      service.analyzeApplication('SYNTHETIC-REF-001', 'en'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('distinguishes a Nest-to-FastAPI timeout from service unavailability', async () => {
    const timeout = new Error('timeout');
    timeout.name = 'TimeoutError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout));
    const { service } = createService();

    await expect(
      service.analyzeApplication('SYNTHETIC-REF-001', 'en'),
    ).rejects.toMatchObject({
      response: {
        code: 'AI_SERVICE_TIMEOUT',
      },
      status: 504,
    });
  });

  it('returns unavailable provider status when the internal service is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { service } = createService();

    await expect(service.getProviderStatus()).resolves.toMatchObject({
      provider: 'Groq',
      model: 'qwen/qwen3.8-27b',
      status: 'UNAVAILABLE',
      reason: 'AI_SERVICE_UNAVAILABLE',
    });
  });

  it('distinguishes an internal service timeout in provider status', async () => {
    const timeout = new Error('timeout');
    timeout.name = 'TimeoutError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout));
    const { service } = createService();

    await expect(service.getProviderStatus()).resolves.toMatchObject({
      status: 'UNAVAILABLE',
      reason: 'AI_SERVICE_TIMEOUT',
    });
  });

  it('marks a missing internal AI service token as not configured', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { service } = createService({ internalToken: null });

    await expect(service.getProviderStatus()).resolves.toMatchObject({
      status: 'NOT_CONFIGURED',
      reason: 'AI_SERVICE_AUTH_NOT_CONFIGURED',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requests a provider connectivity check only when asked', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          provider: 'Groq',
          model: 'qwen/qwen3.8-27b',
          status: 'CONNECTED',
          reason: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const { service } = createService();

    await expect(service.getProviderStatus(true)).resolves.toMatchObject({
      status: 'CONNECTED',
    });
    expect(fetch.mock.calls[0][0]).toBe(
      'http://127.0.0.1:8000/provider-status?check_connectivity=true',
    );
  });

  it('preserves the provider retry delay on rate limits', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: {
              code: 'RATE_LIMITED',
              retryAfterSeconds: 42,
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const { service } = createService();

    await expect(
      service.analyzeApplication('SYNTHETIC-REF-001', 'en'),
    ).rejects.toMatchObject({
      response: {
        code: 'RATE_LIMITED',
        retryAfterSeconds: 42,
      },
      status: 429,
    });
  });

  it('preserves safe provider category and upstream status in gateway errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: {
              code: 'ACCESS_DENIED',
              upstreamStatus: 403,
            },
          }),
          { status: 502, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const { service } = createService();

    await expect(
      service.analyzeApplication('SYNTHETIC-REF-001', 'en'),
    ).rejects.toMatchObject({
      response: {
        code: 'ACCESS_DENIED',
        upstreamStatus: 403,
      },
      status: 502,
    });
  });
});
