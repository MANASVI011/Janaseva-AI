import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationWorkflowStage,
  ApplicationPriority,
  FieldVerificationOutcome,
  FieldVisitStatus,
  OfficerRole,
} from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import type { OfficerIdentity } from '../auth/officer-auth.js';
import { PrismaService } from '../prisma/prisma.service.js';

const checklistItems = [
  'RESIDENTIAL_ADDRESS_CHECKED',
  'RESIDENCE_CONFIRMED',
  'HOUSEHOLD_COMPOSITION_CHECKED',
  'INCOME_INFORMATION_DISCUSSED',
  'INCOME_SOURCES_RECORDED',
  'SUPPORTING_INFORMATION_REVIEWED',
  'APPLICANT_INTERACTION_COMPLETED',
] as const;
const checklistStatuses = [
  'VERIFIED',
  'NOT_VERIFIED',
  'UNABLE_TO_VERIFY',
] as const;
type ChecklistStatus = (typeof checklistStatuses)[number];
type ChecklistAnswer = {
  key: (typeof checklistItems)[number];
  status: ChecklistStatus;
  remarks: string;
};
type FieldChecklist = ChecklistAnswer[];
type ApplicationWithDocuments = Prisma.ApplicationGetPayload<{
  include: {
    documents: { include: { versions: { orderBy: { version: 'desc' } } } };
  };
}>;

const manageRoles = new Set<OfficerRole>([
  OfficerRole.CASEWORKER,
  OfficerRole.AUTHORIZED_OFFICER,
  OfficerRole.ADMIN,
]);
const startableVisitStatuses: FieldVisitStatus[] = [
  FieldVisitStatus.SCHEDULED,
  FieldVisitStatus.DRAFT,
];

function assertText(
  value: unknown,
  name: string,
  options: { required?: boolean; maximum?: number } = {},
) {
  const maximum = options.maximum ?? 1000;
  if (value === undefined || value === null || value === '') {
    if (options.required) {
      throw new BadRequestException(`${name} is required.`);
    }
    return '';
  }
  if (typeof value !== 'string' || value.trim().length > maximum) {
    throw new BadRequestException(
      `${name} must be a string of at most ${maximum} characters.`,
    );
  }
  const result = value.trim();
  if (options.required && !result) {
    throw new BadRequestException(`${name} is required.`);
  }
  return result;
}

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

function parseLocalVisitDate(value: unknown) {
  const input = assertText(value, 'scheduledAt', {
    required: true,
    maximum: 32,
  });
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(input);
  if (!match) {
    throw new BadRequestException('Enter a valid visit date and time.');
  }
  const [, year, month, day, hour, minute] = match;
  const localDate = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    ),
  );
  if (
    localDate.getUTCFullYear() !== Number(year) ||
    localDate.getUTCMonth() !== Number(month) - 1 ||
    localDate.getUTCDate() !== Number(day) ||
    localDate.getUTCHours() !== Number(hour) ||
    localDate.getUTCMinutes() !== Number(minute)
  ) {
    throw new BadRequestException('Enter a valid visit date and time.');
  }
  const date = new Date(localDate.getTime() - 330 * 60_000);
  if (date.getTime() <= Date.now()) {
    throw new BadRequestException(
      'A field visit cannot be scheduled in the past.',
    );
  }
  return date;
}

function parseChecklist(
  value: unknown,
  allowIncomplete: boolean,
): FieldChecklist {
  if (!Array.isArray(value)) {
    if (allowIncomplete) return [];
    throw new BadRequestException(
      'Complete the field checklist before submitting.',
    );
  }
  const answers: FieldChecklist = [];
  for (const key of checklistItems) {
    const raw = value.find(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' &&
        item !== null &&
        'key' in item &&
        item.key === key,
    );
    if (!raw) {
      if (allowIncomplete) continue;
      throw new BadRequestException('Complete every field checklist item.');
    }
    const status =
      typeof raw.status === 'string' &&
      checklistStatuses.includes(raw.status as ChecklistStatus)
        ? (raw.status as ChecklistStatus)
        : null;
    if (!status) {
      if (allowIncomplete) continue;
      throw new BadRequestException(
        'Select a result for every checklist item.',
      );
    }
    answers.push({
      key,
      status,
      remarks: assertText(raw.remarks, 'Checklist remarks', { maximum: 1000 }),
    });
  }
  if (!allowIncomplete && answers.length !== checklistItems.length) {
    throw new BadRequestException('Complete every field checklist item.');
  }
  return answers;
}

function isOutcome(value: unknown): value is FieldVerificationOutcome {
  return (
    typeof value === 'string' &&
    Object.values(FieldVerificationOutcome).includes(
      value as FieldVerificationOutcome,
    )
  );
}

function latestVersion(
  document: ApplicationWithDocuments['documents'][number],
) {
  return document.versions[0];
}

@Injectable()
export class FieldVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async listOfficers() {
    return this.prisma.user.findMany({
      where: { isActive: true, role: OfficerRole.VA_RI },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  async listQueue(query: Record<string, unknown>) {
    const page = parsePage(query.page, 1, 100000);
    const pageSize = parsePage(query.pageSize, 20, 100);
    const search =
      typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';
    const where: Prisma.ApplicationWhereInput = {};
    const fieldFilter: Prisma.FieldVerificationWhereInput = {};
    const scheduledAt: Prisma.DateTimeFilter = {};
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { applicantName: { contains: search, mode: 'insensitive' } },
        { village: { contains: search, mode: 'insensitive' } },
        { hobli: { contains: search, mode: 'insensitive' } },
        { taluk: { contains: search, mode: 'insensitive' } },
        { district: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (typeof query.officer === 'string' && query.officer !== 'all') {
      fieldFilter.assignedOfficerId = query.officer;
    }
    if (
      typeof query.applicationStatus === 'string' &&
      query.applicationStatus !== 'all'
    ) {
      if (
        !Object.values(ApplicationWorkflowStage).includes(
          query.applicationStatus as ApplicationWorkflowStage,
        )
      ) {
        throw new BadRequestException('Application status is invalid.');
      }
      where.workflowStage = query.applicationStatus as ApplicationWorkflowStage;
    }
    if (typeof query.priority === 'string' && query.priority !== 'all') {
      if (
        !Object.values(ApplicationPriority).includes(
          query.priority as ApplicationPriority,
        )
      ) {
        throw new BadRequestException('Application priority is invalid.');
      }
      where.priority = query.priority as ApplicationPriority;
    }
    if (typeof query.visitStatus === 'string' && query.visitStatus !== 'all') {
      if (query.visitStatus === 'OVERDUE') {
        fieldFilter.status = FieldVisitStatus.SCHEDULED;
        scheduledAt.lt = new Date();
      } else if (
        !Object.values(FieldVisitStatus).includes(
          query.visitStatus as FieldVisitStatus,
        )
      ) {
        throw new BadRequestException('Field visit status is invalid.');
      } else {
        fieldFilter.status = query.visitStatus as FieldVisitStatus;
      }
    }
    if (query.from || query.to) {
      if (query.from) scheduledAt.gte = this.parseQueryDate(query.from, 'from');
      if (query.to) scheduledAt.lte = this.parseQueryDate(query.to, 'to', true);
    }
    if (Object.keys(scheduledAt).length > 0) {
      fieldFilter.scheduledAt = scheduledAt;
    }
    const includeApplicationsWithoutAVisit =
      query.visitStatus === FieldVisitStatus.NOT_SCHEDULED &&
      Object.keys(fieldFilter).length === 1 &&
      Object.keys(scheduledAt).length === 0;
    if (includeApplicationsWithoutAVisit) {
      const searchConditions = where.OR ? [{ OR: where.OR }] : [];
      where.AND = [
        ...searchConditions,
        {
          OR: [
            {
              fieldVerification: {
                is: { status: FieldVisitStatus.NOT_SCHEDULED },
              },
            },
            { fieldVerification: { is: null } },
          ],
        },
      ];
      delete where.OR;
    } else if (Object.keys(fieldFilter).length) {
      where.fieldVerification = { is: fieldFilter };
    }

    const sortFields: Record<string, string> = {
      applicationId: 'id',
      applicantName: 'applicantName',
      village: 'village',
      priority: 'priority',
    };
    const sort =
      typeof query.sort === 'string' ? sortFields[query.sort] : undefined;
    if (query.sort && !sort) {
      throw new BadRequestException(
        'Field verification sort field is invalid.',
      );
    }
    const order = query.order === 'asc' ? 'asc' : 'desc';
    const [applications, total, officers, eligibleUnscheduledCount, allFields] =
      await Promise.all([
        this.prisma.application.findMany({
          where,
          include: {
            documents: {
              include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
            },
            fieldVerification: {
              include: {
                assignedOfficer: {
                  select: { id: true, name: true, role: true },
                },
              },
            },
          },
          orderBy: sort
            ? { [sort]: order }
            : [{ priority: 'desc' }, { submissionDate: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.application.count({ where }),
        this.listOfficers(),
        this.prisma.application.count({
          where: {
            status: 'DOCUMENTS_VERIFIED',
            OR: [
              { fieldVerification: { is: null } },
              {
                fieldVerification: {
                  is: { status: FieldVisitStatus.NOT_SCHEDULED },
                },
              },
            ],
          },
        }),
        this.prisma.fieldVerification.findMany({
          select: { status: true, scheduledAt: true },
        }),
      ]);

    const items = await Promise.all(
      applications.map(async (application) => {
        const eligibility = await this.documentEligibility(application);
        const field = application.fieldVerification;
        const overdue =
          field?.status === FieldVisitStatus.SCHEDULED &&
          field.scheduledAt !== null &&
          field.scheduledAt.getTime() < Date.now();
        return {
          applicationId: application.id,
          applicantName: application.applicantName,
          village: application.village,
          submissionDate: application.submissionDate,
          hobli: application.hobli,
          taluk: application.taluk,
          district: application.district,
          documentStatus: application.status,
          workflowStage: application.workflowStage,
          eligibleForScheduling: eligibility.eligible,
          blockingDocuments: eligibility.blockingDocuments,
          assignedOfficer: field?.assignedOfficer ?? null,
          scheduledAt: field?.scheduledAt ?? null,
          visitStatus: overdue ? 'OVERDUE' : (field?.status ?? 'NOT_SCHEDULED'),
          priority: application.priority,
        };
      }),
    );

    const now = Date.now();
    const summary = {
      totalCases: total,
      pendingVisits: eligibleUnscheduledCount,
      scheduledVisits: allFields.filter(
        (item) => item.status === FieldVisitStatus.SCHEDULED,
      ).length,
      inProgressVisits: allFields.filter(
        (item) => item.status === FieldVisitStatus.IN_PROGRESS,
      ).length,
      reportsSubmitted: allFields.filter(
        (item) => item.status === FieldVisitStatus.SUBMITTED,
      ).length,
      furtherVerification: allFields.filter(
        (item) => item.status === FieldVisitStatus.FOLLOW_UP,
      ).length,
      overdueVisits: allFields.filter(
        (item) =>
          item.status === FieldVisitStatus.SCHEDULED &&
          item.scheduledAt !== null &&
          item.scheduledAt.getTime() < now,
      ).length,
    };
    return {
      items,
      officers,
      summary,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getApplication(applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        assignedOfficer: { select: { id: true, name: true, role: true } },
        documents: {
          include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
        },
        fieldVerification: {
          include: {
            assignedOfficer: { select: { id: true, name: true, role: true } },
            assignedBy: { select: { id: true, name: true, role: true } },
            submittedBy: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });
    if (!application) throw new NotFoundException('Application not found.');
    const [eligibility, history, officers] = await Promise.all([
      this.documentEligibility(application),
      this.prisma.fieldVerificationActivity.findMany({
        where: { applicationId },
        include: { officer: { select: { id: true, name: true, role: true } } },
        orderBy: { timestamp: 'desc' },
      }),
      this.listOfficers(),
    ]);
    const field = application.fieldVerification;
    const isOverdue =
      field?.status === FieldVisitStatus.SCHEDULED &&
      field.scheduledAt !== null &&
      field.scheduledAt.getTime() < Date.now();
    return {
      application: {
        id: application.id,
        applicantName: application.applicantName,
        serviceType: application.serviceType,
        village: application.village,
        hobli: application.hobli,
        taluk: application.taluk,
        district: application.district,
        address: application.address,
        annualFamilyIncome: application.annualFamilyIncome,
        purpose: application.applicationPurpose,
        priority: application.priority,
        documentStatus: application.status,
        workflowStage: application.workflowStage,
        assignedCaseOfficer: application.assignedOfficer,
      },
      eligibleForScheduling: eligibility.eligible,
      blockingDocuments: eligibility.blockingDocuments,
      verification: field
        ? { ...field, visitStatus: isOverdue ? 'OVERDUE' : field.status }
        : null,
      officers,
      checklistItems,
      history,
      aiMode: 'DEMONSTRATION',
    };
  }

  async assign(
    applicationId: string,
    body: Record<string, unknown>,
    officer: OfficerIdentity,
  ) {
    this.assertManager(officer);
    const application = await this.applicationForAction(applicationId);
    const assignedOfficerId = assertText(
      body.assignedOfficerId,
      'assignedOfficerId',
      {
        required: true,
        maximum: 100,
      },
    );
    const assigned = await this.prisma.user.findFirst({
      where: { id: assignedOfficerId, isActive: true, role: OfficerRole.VA_RI },
      select: { id: true, name: true, role: true },
    });
    if (!assigned) {
      throw new BadRequestException('Select an active VA / RI officer.');
    }
    const previous = await this.prisma.fieldVerification.findUnique({
      where: { applicationId },
    });
    if (previous?.status === FieldVisitStatus.SUBMITTED) {
      throw new BadRequestException(
        'A submitted field report cannot be reassigned.',
      );
    }
    if (previous?.assignedOfficerId === assignedOfficerId) {
      return {
        ...previous,
        assignedOfficer: assigned,
        application: application.id,
      };
    }
    const record = await this.prisma.$transaction(async (tx) => {
      const verification = await tx.fieldVerification.upsert({
        where: { applicationId },
        create: {
          applicationId,
          assignedOfficerId,
          assignedById: officer.id,
          status: FieldVisitStatus.NOT_SCHEDULED,
        },
        update: { assignedOfficerId, assignedById: officer.id },
      });
      await tx.fieldVerificationActivity.create({
        data: {
          applicationId,
          fieldVerificationId: verification.id,
          officerId: officer.id,
          action: previous?.assignedOfficerId
            ? 'OFFICER_REASSIGNED'
            : 'OFFICER_ASSIGNED',
          details: {
            previousOfficerId: previous?.assignedOfficerId ?? null,
            assignedOfficerId,
            assignedOfficerName: assigned.name,
          },
        },
      });
      return verification;
    });
    return {
      ...record,
      assignedOfficer: assigned,
      application: application.id,
    };
  }

  async schedule(
    applicationId: string,
    body: Record<string, unknown>,
    officer: OfficerIdentity,
    reschedule = false,
  ) {
    this.assertManager(officer);
    const application = await this.applicationForAction(applicationId);
    const eligibility = await this.documentEligibility(application);
    if (!eligibility.eligible) {
      throw new BadRequestException({
        message:
          'Mandatory documents must be verified before scheduling a field visit.',
        blockingDocuments: eligibility.blockingDocuments,
      });
    }
    const previous = await this.prisma.fieldVerification.findUnique({
      where: { applicationId },
    });
    if (!previous?.assignedOfficerId) {
      throw new BadRequestException(
        'Assign a VA / RI before scheduling a visit.',
      );
    }
    if (previous.status === FieldVisitStatus.SUBMITTED) {
      throw new BadRequestException(
        'A submitted field report cannot be rescheduled.',
      );
    }
    if (previous.status === FieldVisitStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'An in-progress field visit cannot be rescheduled.',
      );
    }
    if (!reschedule && previous.scheduledAt) {
      throw new BadRequestException(
        'A visit is already scheduled. Use the reschedule action.',
      );
    }
    const scheduledAt = parseLocalVisitDate(body.scheduledAt);
    const visitVillage = assertText(body.village, 'village', {
      required: true,
      maximum: 150,
    });
    const visitAddress = assertText(body.address, 'address', {
      required: true,
      maximum: 500,
    });
    const instructions = assertText(body.instructions, 'instructions', {
      maximum: 2000,
    });
    const internalNotes = assertText(body.internalNotes, 'internalNotes', {
      maximum: 2000,
    });
    const wasScheduled = Boolean(previous.scheduledAt);
    const isFollowUpVisit = previous.status === FieldVisitStatus.FOLLOW_UP;
    if (reschedule && !wasScheduled) {
      throw new BadRequestException(
        'This application does not have a scheduled visit to reschedule.',
      );
    }

    const record = await this.prisma.$transaction(async (tx) => {
      const verification = await tx.fieldVerification.upsert({
        where: { applicationId },
        create: {
          applicationId,
          assignedOfficerId: previous.assignedOfficerId,
          assignedById: previous.assignedById,
          scheduledAt,
          visitVillage,
          visitAddress,
          instructions: instructions || null,
          internalNotes: internalNotes || null,
          status: FieldVisitStatus.SCHEDULED,
        },
        update: {
          scheduledAt,
          visitVillage,
          visitAddress,
          instructions: instructions || null,
          internalNotes: internalNotes || null,
          status: FieldVisitStatus.SCHEDULED,
          ...(isFollowUpVisit
            ? {
                checklist: Prisma.DbNull,
                observations: null,
                outcome: null,
                reportRemarks: null,
                followUpRequested: false,
                submittedAt: null,
                submittedById: null,
              }
            : {}),
        },
      });
      await tx.application.update({
        where: { id: applicationId },
        data: { workflowStage: ApplicationWorkflowStage.FIELD_VERIFICATION },
      });
      await tx.fieldVerificationActivity.create({
        data: {
          applicationId,
          fieldVerificationId: verification.id,
          officerId: officer.id,
          action: wasScheduled ? 'VISIT_RESCHEDULED' : 'VISIT_SCHEDULED',
          details: {
            previousScheduledAt: previous.scheduledAt?.toISOString() ?? null,
            scheduledAt: scheduledAt.toISOString(),
            assignedOfficerId: verification.assignedOfficerId,
            village: visitVillage,
            address: visitAddress,
            instructions: instructions || null,
            internalNotes: internalNotes || null,
          },
        },
      });
      return verification;
    });
    return record;
  }

  async reschedule(
    verificationId: string,
    body: Record<string, unknown>,
    officer: OfficerIdentity,
  ) {
    const field = await this.prisma.fieldVerification.findUnique({
      where: { id: verificationId },
      select: { applicationId: true },
    });
    if (!field) throw new NotFoundException('Field verification not found.');
    return this.schedule(field.applicationId, body, officer, true);
  }

  async startVisit(verificationId: string, officer: OfficerIdentity) {
    const field = await this.verificationForAction(verificationId, officer);
    if (!field.scheduledAt || !startableVisitStatuses.includes(field.status)) {
      throw new BadRequestException(
        'Only a scheduled visit or its saved draft can be started.',
      );
    }
    if (field.scheduledAt.getTime() > Date.now()) {
      throw new BadRequestException(
        'The scheduled visit time has not arrived.',
      );
    }
    const eligibility = await this.documentEligibility(
      await this.applicationForAction(field.applicationId),
    );
    if (!eligibility.eligible) {
      throw new BadRequestException(
        'Mandatory documents must be verified before starting a field visit.',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.fieldVerification.updateMany({
        where: {
          id: verificationId,
          status: { in: [FieldVisitStatus.SCHEDULED, FieldVisitStatus.DRAFT] },
          scheduledAt: { lte: new Date() },
        },
        data: { status: FieldVisitStatus.IN_PROGRESS },
      });
      if (changed.count !== 1) {
        throw new BadRequestException(
          'This visit is no longer scheduled or its start time has not arrived.',
        );
      }
      const result = await tx.fieldVerification.findUniqueOrThrow({
        where: { id: verificationId },
      });
      await tx.fieldVerificationActivity.create({
        data: {
          applicationId: field.applicationId,
          fieldVerificationId: verificationId,
          officerId: officer.id,
          action: 'VISIT_STARTED',
          details: { startedAt: new Date().toISOString() },
        },
      });
      return result;
    });
  }

  async saveDraft(
    verificationId: string,
    body: Record<string, unknown>,
    officer: OfficerIdentity,
  ) {
    const field = await this.verificationForAction(verificationId, officer);
    if (
      field.status === FieldVisitStatus.SUBMITTED ||
      field.status === FieldVisitStatus.FOLLOW_UP
    ) {
      throw new BadRequestException('A submitted report cannot be edited.');
    }
    if (!field.assignedOfficerId) {
      throw new BadRequestException(
        'Assign an officer before saving a field report draft.',
      );
    }
    const checklist = parseChecklist(body.checklist, true);
    const observations = assertText(body.observations, 'observations', {
      maximum: 5000,
    });
    const outcome =
      body.outcome === '' || body.outcome === null || body.outcome === undefined
        ? null
        : isOutcome(body.outcome)
          ? body.outcome
          : (() => {
              throw new BadRequestException('Field visit outcome is invalid.');
            })();
    const remarks = assertText(body.remarks, 'remarks', { maximum: 5000 });
    const followUpRequested =
      body.followUpRequested === true ||
      outcome === FieldVerificationOutcome.FURTHER_VERIFICATION_REQUIRED;
    const verification = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.fieldVerification.update({
        where: { id: verificationId },
        data: {
          checklist: checklist as Prisma.InputJsonValue,
          observations: observations || null,
          outcome,
          reportRemarks: remarks || null,
          followUpRequested,
          status: FieldVisitStatus.DRAFT,
        },
      });
      await tx.fieldVerificationActivity.create({
        data: {
          applicationId: field.applicationId,
          fieldVerificationId: verificationId,
          officerId: officer.id,
          action: 'REPORT_DRAFT_SAVED',
          details: { completedChecklistItems: checklist.length },
        },
      });
      return updated;
    });
    return verification;
  }

  async submitReport(
    verificationId: string,
    body: Record<string, unknown>,
    officer: OfficerIdentity,
  ) {
    const field = await this.verificationForAction(verificationId, officer);
    if (
      field.status === FieldVisitStatus.SUBMITTED ||
      field.status === FieldVisitStatus.FOLLOW_UP
    ) {
      throw new BadRequestException(
        'This field report has already been submitted.',
      );
    }
    if (!field.scheduledAt || !field.assignedOfficerId) {
      throw new BadRequestException(
        'Assign an officer and schedule a visit before submitting.',
      );
    }
    const visitWasStarted =
      field.status === FieldVisitStatus.IN_PROGRESS ||
      (field.status === FieldVisitStatus.DRAFT &&
        Boolean(
          await this.prisma.fieldVerificationActivity.findFirst({
            where: {
              fieldVerificationId: verificationId,
              action: 'VISIT_STARTED',
            },
            select: { id: true },
          }),
        ));
    if (!visitWasStarted) {
      throw new BadRequestException(
        'Start the scheduled field visit before submitting its report.',
      );
    }
    const eligibility = await this.documentEligibility(
      await this.applicationForAction(field.applicationId),
    );
    if (!eligibility.eligible) {
      throw new BadRequestException(
        'Mandatory documents must be verified before submitting a field report.',
      );
    }
    const checklist = parseChecklist(body.checklist, false);
    const observations = assertText(body.observations, 'observations', {
      required: true,
      maximum: 5000,
    });
    if (!isOutcome(body.outcome)) {
      throw new BadRequestException('Select a field visit outcome.');
    }
    const outcome = body.outcome;
    const remarks = assertText(body.remarks, 'remarks', { maximum: 5000 });
    const followUpRequested =
      body.followUpRequested === true ||
      outcome === FieldVerificationOutcome.FURTHER_VERIFICATION_REQUIRED;
    if (
      (outcome === FieldVerificationOutcome.DISCREPANCY_IDENTIFIED ||
        outcome === FieldVerificationOutcome.APPLICANT_UNAVAILABLE ||
        outcome === FieldVerificationOutcome.FURTHER_VERIFICATION_REQUIRED) &&
      !remarks
    ) {
      throw new BadRequestException(
        'Remarks are required for an unresolved or discrepant outcome.',
      );
    }
    const submittedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.fieldVerification.updateMany({
        where: {
          id: verificationId,
          status: {
            in: [FieldVisitStatus.IN_PROGRESS, FieldVisitStatus.DRAFT],
          },
        },
        data: {
          checklist: checklist as Prisma.InputJsonValue,
          observations,
          outcome,
          reportRemarks: remarks || null,
          followUpRequested,
          submittedAt,
          submittedById: officer.id,
          status: followUpRequested
            ? FieldVisitStatus.FOLLOW_UP
            : FieldVisitStatus.SUBMITTED,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException(
          'This field report has already been submitted.',
        );
      }
      const result = await tx.fieldVerification.findUniqueOrThrow({
        where: { id: verificationId },
      });
      if (!followUpRequested) {
        await tx.application.update({
          where: { id: field.applicationId },
          data: { workflowStage: ApplicationWorkflowStage.FINAL_REVIEW },
        });
      }
      await tx.fieldVerificationActivity.create({
        data: {
          applicationId: field.applicationId,
          fieldVerificationId: verificationId,
          officerId: officer.id,
          action: followUpRequested
            ? 'FOLLOW_UP_REQUESTED'
            : 'FIELD_REPORT_SUBMITTED',
          details: {
            outcome,
            followUpRequested,
            submittedAt: submittedAt.toISOString(),
            checklist,
            observations,
            remarks: remarks || null,
          },
        },
      });
      return result;
    });
  }

  async history(verificationId: string) {
    const verification = await this.prisma.fieldVerification.findUnique({
      where: { id: verificationId },
      select: { applicationId: true },
    });
    if (!verification)
      throw new NotFoundException('Field verification not found.');
    return this.prisma.fieldVerificationActivity.findMany({
      where: { fieldVerificationId: verificationId },
      include: { officer: { select: { id: true, name: true, role: true } } },
      orderBy: { timestamp: 'desc' },
    });
  }

  assist(body: Record<string, unknown>) {
    const observations = assertText(body.observations, 'observations', {
      maximum: 5000,
    });
    const checklist = parseChecklist(body.checklist, true);
    const incomplete = checklistItems.filter(
      (item) => !checklist.some((answer) => answer.key === item),
    );
    const unresolved = checklist.filter(
      (answer) => answer.status !== 'VERIFIED',
    );
    const questions = [
      ...incomplete.map(
        (key) =>
          `Clarify the observation for ${key.replaceAll('_', ' ').toLowerCase()}.`,
      ),
      ...unresolved.map(
        (answer) =>
          `What additional information could clarify ${answer.key.replaceAll('_', ' ').toLowerCase()}?`,
      ),
    ];
    return {
      mode: 'DEMONSTRATION',
      summary: observations
        ? `Officer-entered observations: ${observations}`
        : 'No officer observations have been entered yet.',
      incompleteItems: incomplete,
      statementsForClarification: unresolved.map((answer) => answer.key),
      suggestedQuestions: questions,
      draft: observations ? { observations } : null,
      notice:
        'AI suggestions are advisory only. Field verification findings and final decisions remain the responsibility of authorised government officers.',
    };
  }

  private assertManager(officer: OfficerIdentity) {
    if (!manageRoles.has(officer.role)) {
      throw new ForbiddenException(
        'Only authorised reviewing officers may assign or schedule field visits.',
      );
    }
  }

  private async verificationForAction(id: string, officer: OfficerIdentity) {
    const field = await this.prisma.fieldVerification.findUnique({
      where: { id },
    });
    if (!field) throw new NotFoundException('Field verification not found.');
    if (
      officer.role !== OfficerRole.ADMIN &&
      officer.role !== OfficerRole.AUTHORIZED_OFFICER &&
      (officer.role !== OfficerRole.VA_RI ||
        field.assignedOfficerId !== officer.id)
    ) {
      throw new ForbiddenException(
        'Only the assigned VA / RI may edit this field report.',
      );
    }
    return field;
  }

  private async applicationForAction(applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        documents: {
          include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
        },
      },
    });
    if (!application) throw new NotFoundException('Application not found.');
    return application;
  }

  private async documentEligibility(application: ApplicationWithDocuments) {
    const requirements = await this.prisma.documentRequirement.findMany({
      where: { serviceType: application.serviceType, required: true },
      select: { category: true, label: true },
    });
    const blockingDocuments = requirements
      .filter((requirement) => {
        const document = application.documents.find(
          (item) =>
            item.category === requirement.category &&
            item.label === requirement.label,
        );
        return !document || latestVersion(document)?.status !== 'VERIFIED';
      })
      .map((item) => ({ category: item.category, label: item.label }));
    return {
      eligible: requirements.length > 0 && blockingDocuments.length === 0,
      blockingDocuments,
    };
  }

  private parseQueryDate(value: unknown, name: string, endOfDay = false) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`The ${name} date is invalid.`);
    }
    const [year, month, day] = value.split('-').map(Number);
    const localDate = new Date(Date.UTC(year, month - 1, day));
    if (
      localDate.getUTCFullYear() !== year ||
      localDate.getUTCMonth() !== month - 1 ||
      localDate.getUTCDate() !== day
    ) {
      throw new BadRequestException(`The ${name} date is invalid.`);
    }
    return new Date(
      localDate.getTime() + (endOfDay ? 86_399_999 : 0) - 330 * 60_000,
    );
  }
}
