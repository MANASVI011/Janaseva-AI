import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ApplicationAnalysisRequest } from './ai-analysis.types.js';

const disclaimer =
  'AI-generated assistance is advisory only. The authorized officer must independently verify all findings and make the final decision.';
const defaultModel = 'qwen/qwen3.8-27b';
const maxAnalysisListSize = 8;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxAnalysisListSize &&
    value.every(
      (item) =>
        typeof item === 'string' &&
        item.trim().length > 0 &&
        item.length <= 300,
    )
  );
}

function validateAnalysis(value: unknown) {
  if (
    !isRecord(value) ||
    typeof value.summary !== 'string' ||
    !value.summary.trim() ||
    value.summary.length > 1200 ||
    !isStringList(value.missingInformation) ||
    !isStringList(value.potentialInconsistencies) ||
    !isStringList(value.documentObservations) ||
    !isStringList(value.fieldVerificationObservations) ||
    !isStringList(value.suggestedQuestions) ||
    !isStringList(value.officerAttentionPoints) ||
    value.disclaimer !== disclaimer
  ) {
    throw new BadGatewayException({
      code: 'AI_INVALID_RESPONSE',
      message: 'The AI service returned an invalid analysis response.',
    });
  }
  return {
    summary: value.summary,
    missingInformation: value.missingInformation,
    potentialInconsistencies: value.potentialInconsistencies,
    documentObservations: value.documentObservations,
    fieldVerificationObservations: value.fieldVerificationObservations,
    suggestedQuestions: value.suggestedQuestions,
    officerAttentionPoints: value.officerAttentionPoints,
    disclaimer: value.disclaimer,
  };
}

function redactText(value: string | null | undefined, privateValues: string[]) {
  if (!value) return null;
  let safeText = value.slice(0, 1200);
  for (const privateValue of privateValues) {
    const needle = privateValue.trim();
    if (needle.length >= 3) {
      safeText = safeText.replace(
        new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
        '[redacted]',
      );
    }
  }
  return safeText
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted]')
    .replace(/\b(?:\d[\s-]?){12}\b/g, '[redacted]')
    .replace(/\b(?:\+?91[\s.-]?)?[6-9]\d(?:[\s-]*\d){8}\b/g, '[redacted]');
}

function safeChecklist(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((answer) => {
    if (!isRecord(answer)) return [];
    if (typeof answer.key !== 'string' || typeof answer.status !== 'string') {
      return [];
    }
    return [
      { item: answer.key.slice(0, 300), outcome: answer.status.slice(0, 300) },
    ];
  });
}

function safeDocumentLabel(
  category: string,
  label: string,
  privateValues: string[],
) {
  return redactText(label || category, privateValues) ?? category;
}

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async analyzeApplication(applicationId: string, language: unknown) {
    if (language !== 'kn' && language !== 'en') {
      throw new BadRequestException({
        code: 'AI_ANALYSIS_LANGUAGE_INVALID',
        message: 'Select Kannada or English for the AI analysis.',
      });
    }
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        documents: {
          include: {
            versions: {
              orderBy: { version: 'desc' },
              take: 1,
              select: { status: true },
            },
          },
        },
        missingRequests: {
          where: { receivedAt: null },
          include: { document: { select: { category: true, label: true } } },
        },
        fieldVerification: {
          select: {
            status: true,
            outcome: true,
            observations: true,
            checklist: true,
            reportRemarks: true,
            followUpRequested: true,
            visitAddress: true,
          },
        },
      },
    });
    if (!application) throw new NotFoundException('Application not found.');

    const requirements = await this.prisma.documentRequirement.findMany({
      where: { serviceType: application.serviceType, required: true },
      select: { category: true, label: true },
    });
    const field = application.fieldVerification;
    if (
      application.documents.length === 0 &&
      !field &&
      requirements.length === 0
    ) {
      throw new BadRequestException({
        code: 'AI_ANALYSIS_NO_DATA',
        message: 'There is not enough application data to analyze.',
      });
    }

    const privateValues = [
      application.applicantName,
      application.address,
      application.village,
      field?.visitAddress ?? '',
    ];
    const documentKey = (category: string, label: string) =>
      `${category}:${label}`;
    const requiredDocuments = new Map(
      requirements.map((requirement) => [
        documentKey(requirement.category, requirement.label),
        requirement,
      ]),
    );
    for (const document of application.documents) {
      if (document.required) {
        requiredDocuments.set(documentKey(document.category, document.label), {
          category: document.category,
          label: document.label,
        });
      }
    }

    const documents = application.documents.map((document) => ({
      name: safeDocumentLabel(document.category, document.label, privateValues),
      documentType: document.category,
      verificationStatus: document.status,
      latestVersionStatus: document.versions[0]?.status ?? null,
      required: document.required,
    }));
    const missingDocuments = [
      ...[...requiredDocuments.values()]
        .filter((required) => {
          const document = application.documents.find(
            (item) =>
              item.category === required.category &&
              item.label === required.label,
          );
          return (
            !document ||
            document.status !== DocumentStatus.VERIFIED ||
            document.versions[0]?.status !== DocumentStatus.VERIFIED
          );
        })
        .map((document) =>
          safeDocumentLabel(document.category, document.label, privateValues),
        ),
      ...application.missingRequests.map((request) =>
        safeDocumentLabel(
          request.document?.category ?? request.category,
          request.document?.label ?? '',
          privateValues,
        ),
      ),
    ];

    const payload: ApplicationAnalysisRequest = {
      analysisLanguage: language,
      applicationReferenceId: 'INCOME_CERTIFICATE_APPLICATION',
      serviceType: application.serviceType,
      applicationDetails: {
        applicationStatus: application.status,
        workflowStage: application.workflowStage,
        annualFamilyIncome: application.annualFamilyIncome,
        applicationPurpose:
          redactText(application.applicationPurpose, privateValues) ?? null,
      },
      documents,
      missingDocuments: [...new Set(missingDocuments)],
      fieldVerification: field
        ? {
            status: field.status,
            outcome: field.outcome,
            observations: redactText(field.observations, privateValues),
            checklistOutcomes: safeChecklist(field.checklist),
            officerRemarks: redactText(field.reportRemarks, privateValues),
            followUpRequirements: field.followUpRequested
              ? [
                  redactText(field.reportRemarks, privateValues) ??
                    'Field officer requested follow-up.',
                ]
              : [],
          }
        : null,
    };

    const response = await this.requestAiService('/analyze/application', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return validateAnalysis(response);
  }

  async getProviderStatus(checkConnectivity = false) {
    const fallbackModel =
      this.config.get<string>('GROQ_MODEL')?.trim() || defaultModel;
    try {
      const response = await this.requestAiService(
        `/provider-status${checkConnectivity ? '?check_connectivity=true' : ''}`,
      );
      if (
        !isRecord(response) ||
        response.provider !== 'Groq' ||
        typeof response.model !== 'string' ||
        !['CONNECTED', 'CONFIGURED', 'NOT_CONFIGURED', 'UNAVAILABLE'].includes(
          String(response.status),
        )
      ) {
        return {
          provider: 'Groq',
          model: fallbackModel,
          status: 'UNAVAILABLE' as const,
          reason: 'INVALID_STATUS_RESPONSE',
        };
      }
      return {
        provider: 'Groq',
        model: response.model,
        status: response.status as
          'CONNECTED' | 'CONFIGURED' | 'NOT_CONFIGURED' | 'UNAVAILABLE',
        reason: typeof response.reason === 'string' ? response.reason : null,
      };
    } catch (cause) {
      if (cause instanceof GatewayTimeoutException) {
        const errorResponse = cause.getResponse();
        return {
          provider: 'Groq',
          model: fallbackModel,
          status: 'UNAVAILABLE' as const,
          reason:
            isRecord(errorResponse) && typeof errorResponse.code === 'string'
              ? errorResponse.code
              : 'AI_SERVICE_TIMEOUT',
        };
      }
      if (cause instanceof HttpException) {
        const errorResponse = cause.getResponse();
        if (
          isRecord(errorResponse) &&
          [
            'AI_SERVICE_AUTH_NOT_CONFIGURED',
            'AI_SERVICE_UNAUTHORIZED',
          ].includes(String(errorResponse.code))
        ) {
          return {
            provider: 'Groq',
            model: fallbackModel,
            status:
              errorResponse.code === 'AI_SERVICE_AUTH_NOT_CONFIGURED'
                ? ('NOT_CONFIGURED' as const)
                : ('UNAVAILABLE' as const),
            reason: String(errorResponse.code),
          };
        }
      }
      return {
        provider: 'Groq',
        model: fallbackModel,
        status: 'UNAVAILABLE' as const,
        reason: 'AI_SERVICE_UNAVAILABLE',
      };
    }
  }

  private async requestAiService(path: string, init?: RequestInit) {
    const baseUrl = (
      this.config.get<string>('AI_SERVICE_URL') ?? 'http://127.0.0.1:8000'
    ).replace(/\/+$/, '');
    const serviceToken = this.config.get<string>('AI_SERVICE_TOKEN')?.trim();
    if (!serviceToken) {
      throw new ServiceUnavailableException({
        code: 'AI_SERVICE_AUTH_NOT_CONFIGURED',
        message: 'The internal AI service is not configured.',
      });
    }
    let response: Response;
    const started = performance.now();
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          'X-Janaseva-AI-Service-Token': serviceToken,
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
          ...init?.headers,
        },
        signal: AbortSignal.timeout(55_000),
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'TimeoutError') {
        this.logger.warn(
          `ai_stage=nest_to_fastapi elapsed_ms=${Math.round(performance.now() - started)}`,
        );
        throw new GatewayTimeoutException({
          code: 'AI_SERVICE_TIMEOUT',
          message: 'The NestJS request to the AI service timed out.',
        });
      }
      this.logger.warn(
        `ai_stage=nest_to_fastapi elapsed_ms=${Math.round(performance.now() - started)}`,
      );
      throw new ServiceUnavailableException({
        code: 'AI_SERVICE_UNAVAILABLE',
        message: 'The AI service could not be reached.',
      });
    }
    this.logger.log(
      `ai_stage=nest_to_fastapi elapsed_ms=${Math.round(performance.now() - started)}`,
    );

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new BadGatewayException({
        code: 'AI_INVALID_RESPONSE',
        message: 'The AI service returned an invalid response.',
      });
    }
    if (response.ok) return body;

    const detail =
      isRecord(body) && isRecord(body.detail) ? body.detail : undefined;
    const code =
      typeof detail?.code === 'string' ? detail.code : 'PROVIDER_UNAVAILABLE';
    const retryAfterSeconds =
      typeof detail?.retryAfterSeconds === 'number' &&
      Number.isFinite(detail.retryAfterSeconds)
        ? Math.max(0, Math.min(86_400, Math.floor(detail.retryAfterSeconds)))
        : undefined;
    const upstreamStatus =
      typeof detail?.upstreamStatus === 'number' &&
      Number.isInteger(detail.upstreamStatus) &&
      detail.upstreamStatus >= 400 &&
      detail.upstreamStatus <= 599
        ? detail.upstreamStatus
        : undefined;
    const message =
      code === 'NOT_CONFIGURED'
        ? 'Groq is not configured.'
        : code === 'RATE_LIMITED'
          ? 'Groq Free plan rate limit reached.'
          : code === 'TIMEOUT'
            ? 'The Groq request timed out.'
            : code === 'PROVIDER_TIMEOUT'
              ? 'The Groq provider request timed out.'
              : code === 'FASTAPI_REQUEST_TIMEOUT'
                ? 'The FastAPI analysis request timed out.'
                : code === 'INVALID_MODEL_RESPONSE'
                  ? 'Groq returned an invalid analysis response.'
                  : code === 'ACCESS_DENIED'
                    ? 'Groq denied access to this request.'
                    : code === 'MODEL_OR_ENDPOINT_NOT_FOUND'
                      ? 'Groq could not find the configured model or endpoint.'
                      : code === 'INVALID_REQUEST'
                        ? 'Groq rejected the analysis request.'
                        : code === 'PROVIDER_ERROR'
                          ? 'Groq returned a provider error.'
                          : 'Groq is currently unavailable.';
    if (code === 'NOT_CONFIGURED') {
      throw new ServiceUnavailableException({ code, message });
    }
    if (response.status === 429) {
      throw new HttpException(
        {
          code,
          message,
          ...(upstreamStatus === undefined ? {} : { upstreamStatus }),
          ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
        },
        429,
      );
    }
    if (response.status === 504) {
      throw new GatewayTimeoutException({
        code,
        message,
        ...(upstreamStatus === undefined ? {} : { upstreamStatus }),
      });
    }
    throw new BadGatewayException({
      code,
      message,
      ...(upstreamStatus === undefined ? {} : { upstreamStatus }),
    });
  }
}
