import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { OfficerRole } from '../src/generated/prisma/enums.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const record = {
  id: 'SYNTHETIC-AI-001',
  applicantName: 'Synthetic Applicant',
  village: 'Synthetic Village',
  address: '14 Synthetic Road',
  serviceType: 'INCOME_CERTIFICATE',
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
    observations: 'Synthetic Applicant lives at 14 Synthetic Road.',
    checklist: [{ key: 'RESIDENCE_CONFIRMED', status: 'VERIFIED' }],
    reportRemarks: null,
    followUpRequested: false,
    visitAddress: '14 Synthetic Road',
  },
};

const analysis = {
  summary: 'The synthetic application includes verified source records.',
  missingInformation: [],
  potentialInconsistencies: [],
  documentObservations: ['The income declaration is verified.'],
  fieldVerificationObservations: [
    'The submitted report records a supported outcome.',
  ],
  suggestedQuestions: [],
  officerAttentionPoints: [],
  disclaimer:
    'AI-generated assistance is advisory only. The authorized officer must independently verify all findings and make the final decision.',
};

describe('AI analysis API (e2e)', () => {
  let app: INestApplication;
  const fetchMock = vi.fn();
  const prismaMock = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'demo-caseworker',
        name: 'Synthetic caseworker',
        role: OfficerRole.CASEWORKER,
        isActive: true,
      }),
    },
    application: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        where.id === record.id ? record : null,
      ),
    },
    documentRequirement: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };

  beforeAll(async () => {
    vi.stubEnv('AI_SERVICE_TOKEN', 'synthetic-internal-token');
    vi.stubGlobal('fetch', fetchMock);
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    fetchMock.mockReset();
    prismaMock.application.findUnique.mockClear();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(analysis), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('requires an authenticated officer', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/applications/${record.id}/ai-analysis`)
      .set('Origin', 'http://localhost:3001');

    expect([401, 503]).toContain(response.status);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 404 for an application absent from the shared database', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/applications/NOT-FOUND/ai-analysis')
      .send({ language: 'en' })
      .set('Origin', 'http://localhost:3001')
      .set('X-Janaseva-Demo-Auth', 'enabled');

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns validated analysis for the existing application', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/applications/${record.id}/ai-analysis`)
      .send({ language: 'en' })
      .set('Origin', 'http://localhost:3001')
      .set('X-Janaseva-Demo-Auth', 'enabled');

    expect(response.status).toBe(201);
    expect(response.body).toEqual(analysis);
    expect(fetchMock).toHaveBeenCalledOnce();
    const outgoing = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(
      fetchMock.mock.calls[0][1].headers['X-Janaseva-AI-Service-Token'],
    ).toBe('synthetic-internal-token');
    expect(outgoing.applicationReferenceId).toBe(
      'INCOME_CERTIFICATE_APPLICATION',
    );
    expect(JSON.stringify(outgoing)).not.toContain(record.id);
    expect(JSON.stringify(outgoing)).not.toContain(record.applicantName);
    expect(JSON.stringify(outgoing)).not.toContain(record.address);
  });

  it('reports the configured provider state without exposing a key', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          provider: 'Groq',
          model: 'qwen/qwen3.8-27b',
          status: 'CONFIGURED',
          reason: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const response = await request(app.getHttpServer())
      .get('/api/ai/provider-status')
      .set('X-Janaseva-Demo-Auth', 'enabled');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      provider: 'Groq',
      model: 'qwen/qwen3.8-27b',
      status: 'CONFIGURED',
    });
    expect(response.text).not.toContain('API_KEY');
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.headers.pragma).toBe('no-cache');
    expect(response.headers.expires).toBe('0');
  });

  it('forwards explicit provider connectivity checks', async () => {
    fetchMock.mockResolvedValueOnce(
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

    const response = await request(app.getHttpServer())
      .get('/api/ai/provider-status?checkConnectivity=true')
      .set('X-Janaseva-Demo-Auth', 'enabled');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('CONNECTED');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:8000/provider-status?check_connectivity=true',
    );
  });
});
