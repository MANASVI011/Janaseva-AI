import {
  ApplicationDocumentStatus,
  ApplicationWorkflowStage,
  FieldVisitStatus,
} from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';

export const applicationAttentionWhere: Prisma.ApplicationWhereInput = {
  AND: [
    { workflowStage: { not: ApplicationWorkflowStage.COMPLETED } },
    {
      OR: [
        {
          status: {
            in: [
              ApplicationDocumentStatus.DOCUMENT_REVIEW_PENDING,
              ApplicationDocumentStatus.DOCUMENTS_AWAITING_REPLACEMENT,
              ApplicationDocumentStatus.DOCUMENTS_INCOMPLETE,
              ApplicationDocumentStatus.DOCUMENTS_REJECTED,
            ],
          },
        },
        { missingRequests: { some: { receivedAt: null } } },
        {
          fieldVerification: {
            is: { status: FieldVisitStatus.FOLLOW_UP },
          },
        },
      ],
    },
  ],
};
