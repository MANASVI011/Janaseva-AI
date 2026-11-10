import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationDecisionStatus,
  ApplicationDecisionType,
  ApplicationWorkflowStage,
  DocumentStatus,
  FieldVerificationOutcome,
  FieldVisitStatus,
  OfficerRole,
} from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import type { OfficerIdentity } from '../auth/officer-auth.js';
import { PrismaService } from '../prisma/prisma.service.js';

const finalReviewInclude = {
  assignedOfficer: { select: { id: true, name: true, role: true } },
  documents: {
    include: { versions: { orderBy: { version: 'desc' } } },
  },
  fieldVerification: {
    include: {
      assignedOfficer: { select: { id: true, name: true, role: true } },
      submittedBy: { select: { id: true, name: true, role: true } },
    },
  },
  missingRequests: {
    orderBy: { requestedAt: 'desc' },
    include: { requestedBy: { select: { id: true, name: true, role: true } } },
  },
  decisions: {
    orderBy: { createdAt: 'desc' },
    include: { officer: { select: { id: true, name: true, role: true } } },
  },
} satisfies Prisma.ApplicationInclude;

type ReviewApplication = Prisma.ApplicationGetPayload<{
  include: typeof finalReviewInclude;
}>;
type Requirement = {
  category: ReviewApplication['documents'][number]['category'];
  label: string;
  required: boolean;
};

const authorizedReviewRoles = [
  OfficerRole.AUTHORIZED_OFFICER,
  OfficerRole.ADMIN,
];
const checklistKeys = [
  'RESIDENTIAL_ADDRESS_CHECKED',
  'RESIDENCE_CONFIRMED',
  'HOUSEHOLD_COMPOSITION_CHECKED',
  'INCOME_INFORMATION_DISCUSSED',
  'INCOME_SOURCES_RECORDED',
  'SUPPORTING_INFORMATION_REVIEWED',
  'APPLICANT_INTERACTION_COMPLETED',
];
const checklistStatuses = ['VERIFIED', 'NOT_VERIFIED', 'UNABLE_TO_VERIFY'];

function parsePage(value: unknown, fallback: number, maximum: number) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new BadRequestException(
      `Pagination value must be between 1 and ${maximum}.`,
    );
  }
  return parsed;
}

function parseDecision(value: unknown): ApplicationDecisionType {
  if (
    typeof value !== 'string' ||
    !Object.values(ApplicationDecisionType).includes(
      value as ApplicationDecisionType,
    )
  ) {
    throw new BadRequestException('Select a valid application decision.');
  }
  return value as ApplicationDecisionType;
}

function parseRemarks(value: unknown, required: boolean): string | null {
  if (value === undefined || value === null || value === '') {
    if (required)
      throw new BadRequestException('Decision remarks are required.');
    return null;
  }
  if (typeof value !== 'string' || value.trim().length > 3000) {
    throw new BadRequestException(
      'Decision remarks must be at most 3000 characters.',
    );
  }
  const remarks = value.trim();
  if (required && !remarks) {
    throw new BadRequestException('Decision remarks are required.');
  }
  return remarks || null;
}

function evaluateEligibility(
  application: ReviewApplication,
  requirements: Requirement[],
) {
  const requiredById = new Map<string, Requirement>();
  for (const requirement of requirements.filter((item) => item.required)) {
    requiredById.set(
      `${requirement.category}:${requirement.label}`,
      requirement,
    );
  }
  for (const document of application.documents.filter(
    (item) => item.required,
  )) {
    requiredById.set(`${document.category}:${document.label}`, {
      category: document.category,
      label: document.label,
      required: true,
    });
  }
  const requiredDocuments = [...requiredById.values()];
  const missingRequiredDocuments = requiredDocuments.filter((requirement) => {
    const document = application.documents.find(
      (item) =>
        item.category === requirement.category &&
        item.label === requirement.label,
    );
    return (
      !document ||
      document.status !== DocumentStatus.VERIFIED ||
      document.versions[0]?.status !== DocumentStatus.VERIFIED
    );
  });
  const field = application.fieldVerification;
  const checklist = Array.isArray(field?.checklist) ? field.checklist : [];
  const completeChecklist =
    checklist.length === checklistKeys.length &&
    checklistKeys.every((key) =>
      checklist.some(
        (answer) =>
          typeof answer === 'object' &&
          answer !== null &&
          !Array.isArray(answer) &&
          'key' in answer &&
          answer.key === key &&
          'status' in answer &&
          typeof answer.status === 'string' &&
          checklistStatuses.includes(answer.status),
      ),
    );
  const blockers: string[] = [];

  if (application.workflowStage !== ApplicationWorkflowStage.FINAL_REVIEW) {
    blockers.push('NOT_IN_FINAL_REVIEW');
  }
  if (requiredDocuments.length === 0) {
    blockers.push('REQUIRED_DOCUMENTS_NOT_CONFIGURED');
  }
  if (missingRequiredDocuments.length > 0) {
    blockers.push('REQUIRED_DOCUMENTS_NOT_VERIFIED');
  }
  if (
    !field ||
    field.status !== FieldVisitStatus.SUBMITTED ||
    !field.submittedAt ||
    !field.outcome ||
    field.followUpRequested ||
    field.outcome === FieldVerificationOutcome.FURTHER_VERIFICATION_REQUIRED ||
    !completeChecklist
  ) {
    blockers.push('FIELD_VERIFICATION_INCOMPLETE');
  }

  return { allowed: blockers.length === 0, blockers, missingRequiredDocuments };
}

function applicationSummary(application: ReviewApplication) {
  const field = application.fieldVerification;
  const latestDecision = application.decisions[0] ?? null;
  return {
    id: application.id,
    applicantName: application.applicantName,
    village: application.village,
    submissionDate: application.submissionDate,
    serviceType: application.serviceType,
    status: application.status,
    decisionStatus: application.decisionStatus,
    workflowStage: application.workflowStage,
    priority: application.priority,
    assignedOfficer: application.assignedOfficer,
    fieldVerificationStatus: field?.status ?? FieldVisitStatus.NOT_SCHEDULED,
    fieldOfficer: field?.assignedOfficer ?? null,
    latestDecision: latestDecision
      ? {
          decision: latestDecision.decision,
          resultingStatus: latestDecision.resultingStatus,
          createdAt: latestDecision.createdAt,
          officer: latestDecision.officer,
        }
      : null,
  };
}

@Injectable()
export class FinalReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async listQueue(query: Record<string, unknown>) {
    const page = parsePage(query.page, 1, 100000);
    const pageSize = parsePage(query.pageSize, 20, 100);
    const search =
      typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';
    const where: Prisma.ApplicationWhereInput = {
      workflowStage: ApplicationWorkflowStage.FINAL_REVIEW,
    };
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { applicantName: { contains: search, mode: 'insensitive' } },
        { village: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [applications, total, reviewers] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: finalReviewInclude,
        orderBy: [{ submissionDate: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.application.count({ where }),
      this.prisma.user.findMany({
        where: { isActive: true, role: { in: authorizedReviewRoles } },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const serviceTypes = [
      ...new Set(applications.map((item) => item.serviceType)),
    ];
    const requirements = await this.prisma.documentRequirement.findMany({
      where: { serviceType: { in: serviceTypes } },
    });

    return {
      items: applications.map((application) => {
        const eligibility = evaluateEligibility(
          application,
          requirements.filter(
            (requirement) =>
              requirement.serviceType === application.serviceType,
          ),
        );
        return {
          ...applicationSummary(application),
          eligible: eligibility.allowed,
          blockers: eligibility.blockers,
          missingRequiredDocuments: eligibility.missingRequiredDocuments,
        };
      }),
      reviewers,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getApplication(applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: finalReviewInclude,
    });
    if (!application) throw new NotFoundException('Application not found.');

    const requirements = await this.prisma.documentRequirement.findMany({
      where: { serviceType: application.serviceType },
    });
    const eligibility = evaluateEligibility(application, requirements);

    return {
      application: {
        ...applicationSummary(application),
        hobli: application.hobli,
        taluk: application.taluk,
        district: application.district,
        address: application.address,
        annualFamilyIncome: application.annualFamilyIncome,
        applicationPurpose: application.applicationPurpose,
      },
      fieldVerification: application.fieldVerification
        ? {
            id: application.fieldVerification.id,
            status: application.fieldVerification.status,
            assignedOfficer: application.fieldVerification.assignedOfficer,
            scheduledAt: application.fieldVerification.scheduledAt,
            visitVillage: application.fieldVerification.visitVillage,
            visitAddress: application.fieldVerification.visitAddress,
            checklist: application.fieldVerification.checklist,
            observations: application.fieldVerification.observations,
            outcome: application.fieldVerification.outcome,
            reportRemarks: application.fieldVerification.reportRemarks,
            followUpRequested: application.fieldVerification.followUpRequested,
            submittedAt: application.fieldVerification.submittedAt,
            submittedBy: application.fieldVerification.submittedBy,
          }
        : null,
      missingRequests: application.missingRequests,
      decisions: [...application.decisions].reverse(),
      eligibility,
    };
  }

  async submitDecision(
    applicationId: string,
    body: unknown,
    officer: OfficerIdentity,
  ) {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new BadRequestException('Provide a valid final decision request.');
    }
    const requestBody = body as Record<string, unknown>;
    const decision = parseDecision(requestBody.decision);
    const remarks = parseRemarks(
      requestBody.remarks,
      decision !== ApplicationDecisionType.APPROVE,
    );
    const resultingStatus: Record<
      ApplicationDecisionType,
      ApplicationDecisionStatus
    > = {
      APPROVE: ApplicationDecisionStatus.APPROVED,
      REJECT: ApplicationDecisionStatus.REJECTED,
      RETURN_FOR_CORRECTION: ApplicationDecisionStatus.RETURNED_FOR_CORRECTION,
    };
    const newWorkflowStage: Record<
      ApplicationDecisionType,
      ApplicationWorkflowStage
    > = {
      APPROVE: ApplicationWorkflowStage.COMPLETED,
      REJECT: ApplicationWorkflowStage.COMPLETED,
      RETURN_FOR_CORRECTION: ApplicationWorkflowStage.DOCUMENT_VERIFICATION,
    };

    return this.prisma.$transaction(async (transaction) => {
      const application = await transaction.application.findUnique({
        where: { id: applicationId },
        include: finalReviewInclude,
      });
      if (!application) throw new NotFoundException('Application not found.');
      if (application.workflowStage !== ApplicationWorkflowStage.FINAL_REVIEW) {
        throw new ConflictException(
          'The application is no longer waiting for final review.',
        );
      }
      const requirements = await transaction.documentRequirement.findMany({
        where: { serviceType: application.serviceType },
      });
      const eligibility = evaluateEligibility(application, requirements);
      if (!eligibility.allowed) {
        throw new BadRequestException(
          `The application is not eligible for a final decision: ${eligibility.blockers.join(', ')}.`,
        );
      }

      const nextStatus = resultingStatus[decision];
      const nextStage = newWorkflowStage[decision];
      const transition = await transaction.application.updateMany({
        where: {
          id: applicationId,
          workflowStage: ApplicationWorkflowStage.FINAL_REVIEW,
        },
        data: { decisionStatus: nextStatus, workflowStage: nextStage },
      });
      if (transition.count !== 1) {
        throw new ConflictException(
          'The application decision was already submitted.',
        );
      }

      const savedDecision = await transaction.applicationDecision.create({
        data: {
          applicationId,
          officerId: officer.id,
          decision,
          resultingStatus: nextStatus,
          previousStatus: application.decisionStatus,
          previousWorkflowStage: application.workflowStage,
          newWorkflowStage: nextStage,
          remarks,
        },
        include: { officer: { select: { id: true, name: true, role: true } } },
      });

      return {
        decision: savedDecision,
        application: {
          id: application.id,
          status: application.status,
          decisionStatus: nextStatus,
          workflowStage: nextStage,
        },
      };
    });
  }
}
