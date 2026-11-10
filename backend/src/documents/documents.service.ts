import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  ApplicationPriority,
  ApplicationDocumentStatus,
  ApplicationWorkflowStage,
  DocumentCategory,
  DocumentStatus,
  OfficerRole,
} from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { applicationAttentionWhere } from '../operations/application-attention.js';
import { calculateApplicationDocumentStatus } from './document-status.js';
import { DocumentStorageService } from './document-storage.service.js';

type Officer = { id: string; role: OfficerRole; name: string };
type UploadedDocument = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const categoryValues = new Set<string>(Object.values(DocumentCategory));
const statusValues = new Set<string>(Object.values(ApplicationDocumentStatus));
const stageValues = new Set<string>(Object.values(ApplicationWorkflowStage));
function assertText(value: unknown, name: string, maxLength = 1000): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > maxLength
  ) {
    throw new BadRequestException(
      `${name} must be a non-empty string of at most ${maxLength} characters.`,
    );
  }
  return value.trim();
}

function safeFilename(value: string): string {
  const leaf = value.split(/[\\/]/).pop() ?? '';
  const cleaned = Array.from(leaf)
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && codePoint >= 0x20 && codePoint !== 0x7f;
    })
    .join('')
    .replace(/[^\p{L}\p{N}._ -]/gu, '_')
    .trim()
    .slice(0, 180);
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new BadRequestException('The uploaded filename is invalid.');
  }
  return cleaned;
}

function category(value: unknown): DocumentCategory {
  if (typeof value !== 'string' || !categoryValues.has(value)) {
    throw new BadRequestException('A supported document category is required.');
  }
  return value as DocumentCategory;
}

function labelFor(categoryValue: DocumentCategory, input?: unknown): string {
  if (categoryValue === DocumentCategory.OTHER) {
    return assertText(input, 'label', 100);
  }
  return '';
}

function parsePage(value: unknown, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new BadRequestException(
      `Pagination value must be between 1 and ${max}.`,
    );
  }
  return parsed;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: DocumentStorageService,
  ) {}

  async listApplications(query: Record<string, unknown>) {
    const page = parsePage(query.page, 1, 100000);
    const pageSize = parsePage(query.pageSize, 20, 100);
    const search =
      typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';
    const where: Prisma.ApplicationWhereInput = {};
    if (search) {
      where.AND = search.split(/\s+/).map((term) => ({
        OR: [
          { id: { contains: term, mode: 'insensitive' } },
          { applicantName: { contains: term, mode: 'insensitive' } },
          { village: { contains: term, mode: 'insensitive' } },
        ],
      }));
    }
    if (
      typeof query.workflowStage === 'string' &&
      query.workflowStage !== 'all'
    ) {
      if (!stageValues.has(query.workflowStage)) {
        throw new BadRequestException('Application workflow stage is invalid.');
      }
      where.workflowStage = query.workflowStage as ApplicationWorkflowStage;
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
    if (query.attentionOnly === 'true') {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        applicationAttentionWhere,
      ];
    }
    const sortFields: Record<
      string,
      keyof Prisma.ApplicationOrderByWithRelationInput
    > = {
      applicationId: 'id',
      applicantName: 'applicantName',
      village: 'village',
      submissionDate: 'submissionDate',
      priority: 'priority',
    };
    const sortField =
      typeof query.sort === 'string' ? sortFields[query.sort] : undefined;
    if (query.sort && !sortField) {
      throw new BadRequestException('Application sort field is invalid.');
    }
    const order = query.order === 'asc' ? 'asc' : 'desc';
    const [applications, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          assignedOfficer: { select: { id: true, name: true, role: true } },
        },
        orderBy: sortField
          ? { [sortField]: order }
          : { submissionDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.application.count({ where }),
    ]);
    return {
      items: applications,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async listVerificationQueue(query: Record<string, unknown>) {
    const page = parsePage(query.page, 1, 100000);
    const pageSize = parsePage(query.pageSize, 10, 100);
    const search =
      typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';
    const where: Prisma.ApplicationWhereInput = {};
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { applicantName: { contains: search, mode: 'insensitive' } },
        { village: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (typeof query.status === 'string' && query.status !== 'all') {
      if (!statusValues.has(query.status)) {
        throw new BadRequestException(
          'Application document status is invalid.',
        );
      }
      where.status = query.status as ApplicationDocumentStatus;
    }
    if (
      typeof query.documentStatus === 'string' &&
      query.documentStatus !== 'all'
    ) {
      if (
        !Object.values(DocumentStatus).includes(
          query.documentStatus as DocumentStatus,
        )
      ) {
        throw new BadRequestException('Document status is invalid.');
      }
      where.documents = {
        some: { status: query.documentStatus as DocumentStatus },
      };
    }
    if (typeof query.stage === 'string' && query.stage !== 'all') {
      if (!stageValues.has(query.stage)) {
        throw new BadRequestException('Application workflow stage is invalid.');
      }
      where.workflowStage = query.stage as ApplicationWorkflowStage;
    }
    if (typeof query.officer === 'string' && query.officer.trim()) {
      where.assignedOfficerId = query.officer.trim().slice(0, 100);
    }
    if (query.from || query.to) {
      const date: Prisma.DateTimeFilter = {};
      if (query.from) date.gte = this.parseDate(query.from, 'from');
      if (query.to) date.lte = this.parseDate(query.to, 'to');
      where.submissionDate = date;
    }

    const sortFields: Record<
      string,
      keyof Prisma.ApplicationOrderByWithRelationInput
    > = {
      applicationId: 'id',
      applicantName: 'applicantName',
      village: 'village',
      submissionDate: 'submissionDate',
      status: 'status',
    };
    const sortField =
      typeof query.sort === 'string' ? sortFields[query.sort] : undefined;
    if (query.sort && !sortField) {
      throw new BadRequestException('Application sort field is invalid.');
    }
    const sortOrder = query.order === 'asc' ? 'asc' : 'desc';
    const [applications, total, all] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          assignedOfficer: { select: { id: true, name: true } },
          documents: {
            include: {
              versions: {
                orderBy: { version: 'desc' },
                take: 1,
                select: { status: true, uploadedAt: true },
              },
            },
          },
        },
        orderBy: sortField
          ? { [sortField]: sortOrder }
          : { submissionDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.application.count({ where }),
      this.prisma.application.findMany({
        include: {
          documents: {
            include: {
              versions: {
                orderBy: { version: 'desc' },
                take: 1,
                select: { id: true, status: true },
              },
            },
          },
        },
      }),
    ]);

    const requirements = await this.prisma.documentRequirement.findMany({
      where: { serviceType: 'INCOME_CERTIFICATE', required: true },
    });
    const summaries = all.map((application) =>
      this.summarize(application, requirements),
    );
    const summary = summaries.reduce(
      (totalSummary, item) => ({
        documentsReceived: totalSummary.documentsReceived + item.documentCount,
        pending: totalSummary.pending + item.pendingCount,
        verified: totalSummary.verified + item.verifiedCount,
        replacementRequested:
          totalSummary.replacementRequested + item.replacementCount,
        missing: totalSummary.missing + item.missingCount,
      }),
      {
        documentsReceived: 0,
        pending: 0,
        verified: 0,
        replacementRequested: 0,
        missing: 0,
      },
    );

    return {
      items: applications.map((application) => ({
        ...this.summarize(application, requirements),
        applicationId: application.id,
        applicantName: application.applicantName,
        village: application.village,
        submissionDate: application.submissionDate,
        assignedOfficer: application.assignedOfficer,
        workflowStage: application.workflowStage,
        lastUpdated: application.documents.reduce<Date | null>(
          (latest, document) => {
            const date = document.updatedAt;
            return !latest || date > latest ? date : latest;
          },
          null,
        ),
      })),
      summary,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  listOfficers() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  async listApplicationDocuments(applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        assignedOfficer: { select: { id: true, name: true } },
        documents: {
          include: {
            versions: {
              orderBy: { version: 'desc' },
              include: {
                uploadedBy: { select: { id: true, name: true } },
                verifiedBy: { select: { id: true, name: true } },
              },
            },
            missingRequests: {
              orderBy: { requestedAt: 'desc' },
              include: { requestedBy: { select: { id: true, name: true } } },
            },
          },
          orderBy: [{ category: 'asc' }, { label: 'asc' }],
        },
        missingRequests: {
          where: { documentId: null },
          orderBy: { requestedAt: 'desc' },
          include: { requestedBy: { select: { id: true, name: true } } },
        },
      },
    });
    if (!application) throw new NotFoundException('Application not found.');

    const requirements = await this.prisma.documentRequirement.findMany({
      where: { serviceType: application.serviceType },
      orderBy: [{ required: 'desc' }, { category: 'asc' }],
    });
    const rows: Array<Record<string, unknown>> = application.documents.map(
      (document) => ({
        ...document,
        currentVersion: document.versions[0] ?? null,
      }),
    );
    for (const requirement of requirements) {
      const exists = rows.some(
        (document) =>
          document.category === requirement.category &&
          document.label === requirement.label,
      );
      if (!exists) {
        rows.push({
          id: null,
          applicationId,
          category: requirement.category,
          label: requirement.label,
          required: requirement.required,
          status: DocumentStatus.MISSING,
          requiredReason: null,
          requestedAt: null,
          createdAt: application.submissionDate,
          updatedAt: application.submissionDate,
          versions: [],
          activities: [],
          missingRequests: [],
          currentVersion: null,
          isVirtual: true,
        });
      }
    }
    const applicationSummary = this.summarize(
      { documents: application.documents },
      requirements,
    );
    return {
      application: {
        id: application.id,
        applicantName: application.applicantName,
        village: application.village,
        submissionDate: application.submissionDate,
        assignedOfficer: application.assignedOfficer,
        status: applicationSummary.status,
        workflowStage: application.workflowStage,
      },
      documents: rows,
      requirements,
    };
  }

  async upload(
    applicationId: string,
    file: UploadedDocument | undefined,
    fields: Record<string, unknown>,
    officer: Officer,
  ) {
    if (!file)
      throw new BadRequestException('Select a document file to upload.');
    const mimeType = this.storage.validateFile(file);
    const docCategory = category(fields.category);
    const label = labelFor(docCategory, fields.label);
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });
    if (!application) throw new NotFoundException('Application not found.');

    const existing = await this.prisma.applicationDocument.findFirst({
      where: { applicationId, category: docCategory, label },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    const originalFilename = safeFilename(file.originalname);
    const requirement = await this.prisma.documentRequirement.findFirst({
      where: {
        serviceType: application.serviceType,
        category: docCategory,
        label,
      },
    });
    const storageKey = await this.storage.save(file.buffer, mimeType);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const document = existing
          ? await tx.applicationDocument.update({
              where: { id: existing.id },
              data: { status: DocumentStatus.PENDING_VERIFICATION },
            })
          : await tx.applicationDocument.create({
              data: {
                applicationId,
                category: docCategory,
                label,
                required: requirement?.required ?? false,
                status: DocumentStatus.PENDING_VERIFICATION,
              },
            });
        const previousVersion = existing?.versions[0];
        const version = await tx.documentVersion.create({
          data: {
            documentId: document.id,
            version: (previousVersion?.version ?? 0) + 1,
            originalFilename,
            storageKey,
            mimeType,
            sizeBytes: file.size,
            sha256: createHash('sha256').update(file.buffer).digest('hex'),
            uploadedById: officer.id,
            status: DocumentStatus.PENDING_VERIFICATION,
          },
        });
        await tx.documentActivity.create({
          data: {
            applicationId,
            documentId: document.id,
            action: previousVersion ? 'DOCUMENT_REPLACED' : 'DOCUMENT_UPLOADED',
            previousStatus: existing?.status ?? null,
            newStatus: DocumentStatus.PENDING_VERIFICATION,
            officerId: officer.id,
            remarks: previousVersion
              ? `Version ${version.version} replaced version ${previousVersion.version}.`
              : originalFilename,
          },
        });
        await tx.missingDocumentRequest.updateMany({
          where: { applicationId, category: docCategory, receivedAt: null },
          data: { receivedAt: new Date(), documentId: document.id },
        });
        await this.updateApplicationStatus(tx, applicationId, officer);
        return { documentId: document.id, version };
      });
      return result;
    } catch (error) {
      await this.storage.remove(storageKey);
      throw error;
    }
  }

  async verify(
    documentId: string,
    body: Record<string, unknown>,
    officer: Officer,
  ) {
    const remarks =
      body.remarks === undefined
        ? undefined
        : assertText(body.remarks, 'remarks');
    return this.updateVersionStatus(
      documentId,
      DocumentStatus.VERIFIED,
      officer,
      'DOCUMENT_VERIFIED',
      remarks,
    );
  }

  async reject(
    documentId: string,
    body: Record<string, unknown>,
    officer: Officer,
  ) {
    const reason = assertText(body.reason, 'reason', 1000);
    const remarks =
      body.remarks === undefined
        ? undefined
        : assertText(body.remarks, 'remarks');
    return this.updateVersionStatus(
      documentId,
      DocumentStatus.REJECTED,
      officer,
      'DOCUMENT_REJECTED',
      remarks,
      reason,
    );
  }

  async requestReplacement(
    documentId: string,
    body: Record<string, unknown>,
    officer: Officer,
  ) {
    const reason = assertText(body.reason, 'reason', 1000);
    const details =
      body.details === undefined
        ? undefined
        : assertText(body.details, 'details', 1000);
    return this.updateVersionStatus(
      documentId,
      DocumentStatus.REPLACEMENT_REQUESTED,
      officer,
      'REPLACEMENT_REQUESTED',
      details,
      undefined,
      reason,
    );
  }

  async requestMissing(
    applicationId: string,
    body: Record<string, unknown>,
    officer: Officer,
  ) {
    const entries = body.documents;
    if (!Array.isArray(entries) || entries.length === 0 || entries.length > 7) {
      throw new BadRequestException(
        'Provide between one and seven missing document requests.',
      );
    }
    const parsed = entries.map((entry) => {
      if (!entry || typeof entry !== 'object') {
        throw new BadRequestException(
          'Each missing document request is invalid.',
        );
      }
      const value = entry as Record<string, unknown>;
      const docCategory = category(value.category);
      return {
        category: docCategory,
        label: labelFor(docCategory, value.label),
        reason: assertText(value.reason, 'reason', 1000),
      };
    });
    if (
      new Set(parsed.map((item) => `${item.category}:${item.label}`)).size !==
      parsed.length
    ) {
      throw new BadRequestException(
        'A document category can only be requested once.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const application = await tx.application.findUnique({
        where: { id: applicationId },
      });
      if (!application) throw new NotFoundException('Application not found.');
      const result = [];
      for (const item of parsed) {
        const current = await tx.applicationDocument.findFirst({
          where: {
            applicationId,
            category: item.category,
            label: item.label,
          },
          include: { versions: { take: 1 } },
        });
        if (current?.versions.length) {
          throw new BadRequestException(
            'A document with an uploaded version cannot be marked missing.',
          );
        }
        const document = current
          ? await tx.applicationDocument.update({
              where: { id: current.id },
              data: {
                required: true,
                status: DocumentStatus.MISSING,
                requiredReason: item.reason,
                requestedAt: new Date(),
              },
            })
          : await tx.applicationDocument.create({
              data: {
                applicationId,
                category: item.category,
                label: item.label,
                required: true,
                status: DocumentStatus.MISSING,
                requiredReason: item.reason,
                requestedAt: new Date(),
              },
            });
        await tx.missingDocumentRequest.create({
          data: {
            applicationId,
            documentId: document.id,
            category: item.category,
            reason: item.reason,
            requestedById: officer.id,
          },
        });
        await tx.documentActivity.create({
          data: {
            applicationId,
            documentId: document.id,
            action: 'MISSING_DOCUMENT_REQUESTED',
            previousStatus: current?.status ?? null,
            newStatus: DocumentStatus.MISSING,
            officerId: officer.id,
            remarks: item.reason,
          },
        });
        result.push(document);
      }
      await this.updateApplicationStatus(tx, applicationId, officer);
      return result;
    });
  }

  async setRequired(
    documentId: string,
    body: Record<string, unknown>,
    officer: Officer,
  ) {
    if (body.required !== true) {
      throw new BadRequestException(
        'Required documents can only be added through this operation.',
      );
    }
    const reason = assertText(body.reason, 'reason', 1000);
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.applicationDocument.findUnique({
        where: { id: documentId },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      });
      if (!document) throw new NotFoundException('Document not found.');
      const updated = await tx.applicationDocument.update({
        where: { id: documentId },
        data: {
          required: true,
          requiredReason: reason,
          requestedAt: new Date(),
          status: document.versions.length
            ? document.status
            : DocumentStatus.MISSING,
        },
      });
      await tx.documentActivity.create({
        data: {
          applicationId: document.applicationId,
          documentId,
          action: 'DOCUMENT_MARKED_REQUIRED',
          previousStatus: document.status,
          newStatus: updated.status,
          officerId: officer.id,
          remarks: reason,
        },
      });
      await this.updateApplicationStatus(tx, document.applicationId, officer);
      return updated;
    });
  }

  async history(applicationId: string) {
    const exists = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Application not found.');
    return this.prisma.documentActivity.findMany({
      where: { applicationId, action: { not: 'APPLICATION_SUBMITTED' } },
      include: {
        officer: { select: { id: true, name: true, role: true } },
        document: { select: { id: true, category: true, label: true } },
      },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
    });
  }

  async preview(
    documentId: string,
    versionId: string | undefined,
    officer: Officer,
  ) {
    const version = await this.prisma.documentVersion.findFirst({
      where: {
        documentId,
        ...(versionId ? { id: versionId } : {}),
      },
      orderBy: { version: 'desc' },
      include: {
        document: {
          include: {
            application: { select: { id: true, applicantName: true } },
          },
        },
      },
    });
    if (!version) throw new NotFoundException('Document version not found.');
    const buffer = await this.storage.read(version.storageKey);
    await this.prisma.documentActivity.create({
      data: {
        applicationId: version.document.applicationId,
        documentId,
        action: 'DOCUMENT_PREVIEWED',
        previousStatus: version.status,
        newStatus: version.status,
        officerId: officer.id,
        remarks: `Version ${version.version} previewed.`,
      },
    });
    return { version, application: version.document.application, buffer };
  }

  async documentForAction(documentId: string) {
    const document = await this.prisma.applicationDocument.findUnique({
      where: { id: documentId },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
        application: { select: { id: true } },
      },
    });
    if (!document) throw new NotFoundException('Document not found.');
    const version = document.versions[0];
    if (!version)
      throw new BadRequestException('No uploaded document to review.');
    if (version.status === DocumentStatus.VERIFIED) {
      throw new BadRequestException(
        'This document version is already verified.',
      );
    }
    return { document, version };
  }

  private async updateVersionStatus(
    documentId: string,
    status: DocumentStatus,
    officer: Officer,
    action: string,
    remarks?: string,
    rejectionReason?: string,
    replacementReason?: string,
  ) {
    const { document, version } = await this.documentForAction(documentId);
    return this.prisma.$transaction(async (tx) => {
      const updatedVersion = await tx.documentVersion.update({
        where: { id: version.id },
        data: {
          status,
          verifiedById: status === DocumentStatus.VERIFIED ? officer.id : null,
          verifiedAt: status === DocumentStatus.VERIFIED ? new Date() : null,
          remarks,
          rejectionReason,
          replacementReason,
        },
      });
      await tx.applicationDocument.update({
        where: { id: documentId },
        data: { status },
      });
      await tx.documentActivity.create({
        data: {
          applicationId: document.application.id,
          documentId,
          action,
          previousStatus: document.status,
          newStatus: status,
          officerId: officer.id,
          remarks:
            [rejectionReason, replacementReason, remarks]
              .filter(Boolean)
              .join(' — ')
              .slice(0, 1000) || null,
        },
      });
      const application = await this.updateApplicationStatus(
        tx,
        document.application.id,
        officer,
      );
      return { document: documentId, version: updatedVersion, application };
    });
  }

  private async updateApplicationStatus(
    tx: Prisma.TransactionClient,
    applicationId: string,
    officer: Officer,
  ) {
    const application = await tx.application.findUnique({
      where: { id: applicationId },
      select: { serviceType: true, workflowStage: true },
    });
    if (!application) throw new NotFoundException('Application not found.');
    const [requirements, documents] = await Promise.all([
      tx.documentRequirement.findMany({
        where: { serviceType: application.serviceType, required: true },
      }),
      tx.applicationDocument.findMany({
        where: { applicationId },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      }),
    ]);
    const nextStatus = calculateApplicationDocumentStatus(
      documents,
      requirements,
    );
    const nextStage =
      nextStatus === ApplicationDocumentStatus.DOCUMENTS_VERIFIED
        ? application.workflowStage ===
          ApplicationWorkflowStage.DOCUMENT_VERIFICATION
          ? ApplicationWorkflowStage.FIELD_VERIFICATION
          : application.workflowStage
        : ApplicationWorkflowStage.DOCUMENT_VERIFICATION;
    if (nextStage !== application.workflowStage) {
      await tx.documentActivity.create({
        data: {
          applicationId,
          action: 'WORKFLOW_STAGE_UPDATED',
          officerId: officer.id,
          remarks: `${application.workflowStage} -> ${nextStage}`,
        },
      });
    }
    return tx.application.update({
      where: { id: applicationId },
      data: { status: nextStatus, workflowStage: nextStage },
      select: { id: true, status: true, workflowStage: true },
    });
  }

  private summarize(
    application: {
      documents: {
        required: boolean;
        category: DocumentCategory;
        label: string;
        status: DocumentStatus;
        versions: { id?: string; status: DocumentStatus }[];
      }[];
    },
    requirements: {
      category: DocumentCategory;
      label: string;
      required: boolean;
    }[],
  ) {
    const currentStatuses = application.documents.map(
      (document) => document.versions[0]?.status ?? document.status,
    );
    const missingRequirementCount = requirements.filter((requirement) => {
      if (!requirement.required) return false;
      const document = application.documents.find(
        (item) =>
          item.category === requirement.category &&
          item.label === requirement.label,
      );
      return !document || document.versions.length === 0;
    }).length;
    const missingAdditionalCount = application.documents.filter(
      (document) =>
        document.required &&
        (document.status === DocumentStatus.MISSING ||
          document.versions.length === 0) &&
        !requirements.some(
          (requirement) =>
            requirement.category === document.category &&
            requirement.label === document.label,
        ),
    ).length;
    const missingCount = missingRequirementCount + missingAdditionalCount;
    return {
      documentCount: application.documents.filter(
        (document) => document.versions.length > 0,
      ).length,
      verifiedCount: currentStatuses.filter(
        (status) => status === DocumentStatus.VERIFIED,
      ).length,
      pendingCount: currentStatuses.filter(
        (status) => status === DocumentStatus.PENDING_VERIFICATION,
      ).length,
      replacementCount: currentStatuses.filter(
        (status) => status === DocumentStatus.REPLACEMENT_REQUESTED,
      ).length,
      missingCount,
      status: calculateApplicationDocumentStatus(
        application.documents,
        requirements,
      ),
    };
  }

  private parseDate(value: unknown, name: string): Date {
    if (typeof value !== 'string') {
      throw new BadRequestException(`Date filter "${name}" is invalid.`);
    }
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
      throw new BadRequestException(`Date filter "${name}" is invalid.`);
    }
    return parsed;
  }
}
