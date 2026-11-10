import {
  requestOfficerApi,
  type ApplicationDocumentStatus,
  type ApplicationWorkflowStage,
  type DocumentCategory,
  type VerificationOfficer,
} from "@/lib/document-verification-api";
import type {
  FieldChecklistAnswer,
  FieldVerificationOutcome,
  FieldVisitStatus,
} from "@/lib/field-verification-api";

export type FinalDecision = "APPROVE" | "REJECT" | "RETURN_FOR_CORRECTION";
export type FinalDecisionStatus =
  "APPROVED" | "REJECTED" | "RETURNED_FOR_CORRECTION";

export type FinalReviewQueueItem = {
  id: string;
  applicantName: string;
  village: string;
  submissionDate: string;
  serviceType: string;
  status: ApplicationDocumentStatus;
  decisionStatus: FinalDecisionStatus | null;
  workflowStage: ApplicationWorkflowStage;
  priority: string;
  assignedOfficer: VerificationOfficer | null;
  fieldVerificationStatus: FieldVisitStatus;
  fieldOfficer: VerificationOfficer | null;
  latestDecision: {
    decision: FinalDecision;
    resultingStatus: FinalDecisionStatus;
    createdAt: string;
    officer: VerificationOfficer;
  } | null;
  eligible: boolean;
  blockers: string[];
  missingRequiredDocuments: {
    category: DocumentCategory;
    label: string;
  }[];
};

export type FinalReviewQueue = {
  items: FinalReviewQueueItem[];
  reviewers: VerificationOfficer[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type FinalReviewDecisionRecord = {
  id: string;
  decision: FinalDecision;
  resultingStatus: FinalDecisionStatus;
  previousStatus: FinalDecisionStatus | null;
  previousWorkflowStage: ApplicationWorkflowStage;
  newWorkflowStage: ApplicationWorkflowStage;
  remarks: string | null;
  createdAt: string;
  officer: VerificationOfficer;
};

export type FinalReviewApplication = {
  application: {
    id: string;
    applicantName: string;
    village: string;
    submissionDate: string;
    serviceType: string;
    status: ApplicationDocumentStatus;
    decisionStatus: FinalDecisionStatus | null;
    workflowStage: ApplicationWorkflowStage;
    priority: string;
    assignedOfficer: VerificationOfficer | null;
    fieldVerificationStatus: FieldVisitStatus;
    fieldOfficer: VerificationOfficer | null;
    latestDecision: FinalReviewQueueItem["latestDecision"];
    hobli: string;
    taluk: string;
    district: string;
    address: string;
    annualFamilyIncome: number | null;
    applicationPurpose: string;
  };
  fieldVerification: {
    id: string;
    status: FieldVisitStatus;
    assignedOfficer: VerificationOfficer | null;
    scheduledAt: string | null;
    visitVillage: string | null;
    visitAddress: string | null;
    checklist: FieldChecklistAnswer[] | null;
    observations: string | null;
    outcome: FieldVerificationOutcome | null;
    reportRemarks: string | null;
    followUpRequested: boolean;
    submittedAt: string | null;
    submittedBy: VerificationOfficer | null;
  } | null;
  missingRequests: {
    id: string;
    category: DocumentCategory;
    reason: string;
    requestedAt: string;
    receivedAt: string | null;
    requestedBy: VerificationOfficer;
  }[];
  decisions: FinalReviewDecisionRecord[];
  eligibility: {
    allowed: boolean;
    blockers: string[];
    missingRequiredDocuments: {
      category: DocumentCategory;
      label: string;
    }[];
  };
};

export type FinalDecisionResult = {
  decision: FinalReviewDecisionRecord;
  application: {
    id: string;
    status: ApplicationDocumentStatus;
    decisionStatus: FinalDecisionStatus;
    workflowStage: ApplicationWorkflowStage;
  };
};

export function getFinalReviewQueue(search: string) {
  const parameters = new URLSearchParams({ page: "1", pageSize: "100" });
  if (search.trim()) parameters.set("search", search.trim());
  return requestOfficerApi<FinalReviewQueue>(
    `/final-review?${parameters.toString()}`,
  );
}

export function getFinalReviewApplication(applicationId: string) {
  return requestOfficerApi<FinalReviewApplication>(
    `/applications/${encodeURIComponent(applicationId)}/final-review`,
  );
}

export function submitFinalDecision(
  applicationId: string,
  decision: FinalDecision,
  remarks: string,
  demoReviewerId?: string,
) {
  const headers = new Headers();
  if (demoReviewerId) {
    headers.set("X-Janaseva-Demo-Review-Officer", demoReviewerId);
  }
  return requestOfficerApi<FinalDecisionResult>(
    `/applications/${encodeURIComponent(applicationId)}/final-review/decision`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ decision, remarks }),
    },
  );
}
