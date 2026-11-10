import {
  ApplicationDocumentStatus,
  DocumentStatus,
} from '../generated/prisma/enums.js';
import type { DocumentCategory } from '../generated/prisma/enums.js';

export type StatusDocument = {
  required: boolean;
  category: DocumentCategory;
  label: string;
  status: DocumentStatus;
  versions: { status: DocumentStatus }[];
};

export type StatusRequirement = {
  category: DocumentCategory;
  label: string;
  required: boolean;
};

export function calculateApplicationDocumentStatus(
  documents: StatusDocument[],
  requirements: StatusRequirement[],
): ApplicationDocumentStatus {
  const requiredRequirements = requirements.filter(
    (requirement) => requirement.required,
  );
  const currentStatus = (document: StatusDocument) =>
    document.versions[0]?.status ?? document.status;
  const isMissing = (requirement: StatusRequirement) => {
    const document = documents.find(
      (item) =>
        item.category === requirement.category &&
        item.label === requirement.label,
    );
    return (
      !document ||
      document.status === DocumentStatus.MISSING ||
      document.versions.length === 0
    );
  };
  const missingRequired =
    requiredRequirements.some(isMissing) ||
    documents.some(
      (document) =>
        document.required &&
        (document.status === DocumentStatus.MISSING ||
          document.versions.length === 0),
    );
  const statuses = documents.map(currentStatus);

  if (statuses.includes(DocumentStatus.REJECTED)) {
    return ApplicationDocumentStatus.DOCUMENTS_REJECTED;
  }
  if (statuses.includes(DocumentStatus.REPLACEMENT_REQUESTED)) {
    return ApplicationDocumentStatus.DOCUMENTS_AWAITING_REPLACEMENT;
  }
  if (missingRequired) {
    return ApplicationDocumentStatus.DOCUMENTS_INCOMPLETE;
  }
  if (
    statuses.includes(DocumentStatus.MISSING) ||
    statuses.includes(DocumentStatus.PENDING_VERIFICATION)
  ) {
    return ApplicationDocumentStatus.DOCUMENT_REVIEW_PENDING;
  }
  if (
    requiredRequirements.length > 0 &&
    requiredRequirements.every((requirement) => {
      const document = documents.find(
        (item) =>
          item.category === requirement.category &&
          item.label === requirement.label,
      );
      return (
        document?.status === DocumentStatus.VERIFIED &&
        document.versions[0]?.status === DocumentStatus.VERIFIED
      );
    })
  ) {
    return ApplicationDocumentStatus.DOCUMENTS_VERIFIED;
  }
  return ApplicationDocumentStatus.DOCUMENTS_INCOMPLETE;
}
