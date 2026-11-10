import { getDemoApiResponse } from "@/lib/demo-api";
import {
  isDemoModeEnabled,
  isDocumentDemoAuthEnabled,
} from "@/lib/document-verification-api";

export type FieldVisitStatus =
  | "NOT_SCHEDULED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "DRAFT"
  | "SUBMITTED"
  | "FOLLOW_UP"
  | "OVERDUE";

export type FieldVerificationOutcome =
  | "INFORMATION_SUPPORTED"
  | "DISCREPANCY_IDENTIFIED"
  | "APPLICANT_UNAVAILABLE"
  | "FURTHER_VERIFICATION_REQUIRED";

export type ApplicationWorkflowStage =
  "DOCUMENT_VERIFICATION" | "FIELD_VERIFICATION" | "FINAL_REVIEW" | "COMPLETED";

export type FieldChecklistKey =
  | "RESIDENTIAL_ADDRESS_CHECKED"
  | "RESIDENCE_CONFIRMED"
  | "HOUSEHOLD_COMPOSITION_CHECKED"
  | "INCOME_INFORMATION_DISCUSSED"
  | "INCOME_SOURCES_RECORDED"
  | "SUPPORTING_INFORMATION_REVIEWED"
  | "APPLICANT_INTERACTION_COMPLETED";

export type FieldChecklistAnswer = {
  key: FieldChecklistKey;
  status: "VERIFIED" | "NOT_VERIFIED" | "UNABLE_TO_VERIFY";
  remarks: string;
};

export type FieldOfficer = {
  id: string;
  name: string;
  role: "VA_RI" | "CASEWORKER" | "AUTHORIZED_OFFICER" | "ADMIN";
};

export type FieldQueueItem = {
  applicationId: string;
  applicantName: string;
  village: string;
  hobli: string;
  taluk: string;
  district: string;
  submissionDate: string;
  documentStatus: string;
  workflowStage: ApplicationWorkflowStage;
  eligibleForScheduling: boolean;
  blockingDocuments: { category: string; label: string }[];
  assignedOfficer: FieldOfficer | null;
  scheduledAt: string | null;
  visitStatus: FieldVisitStatus;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
};

export type FieldVerificationSummary = {
  totalCases: number;
  pendingVisits: number;
  scheduledVisits: number;
  inProgressVisits: number;
  reportsSubmitted: number;
  furtherVerification: number;
  overdueVisits: number;
};

export type FieldQueueResponse = {
  items: FieldQueueItem[];
  officers: FieldOfficer[];
  summary: FieldVerificationSummary;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type FieldVerificationActivity = {
  id: string;
  action: string;
  timestamp: string;
  details: Record<string, unknown> | null;
  officer: FieldOfficer;
};

export type FieldVerificationRecord = {
  id: string;
  applicationId: string;
  assignedOfficerId: string | null;
  assignedById: string | null;
  scheduledAt: string | null;
  visitVillage: string | null;
  visitAddress: string | null;
  instructions: string | null;
  internalNotes: string | null;
  status: FieldVisitStatus;
  checklist: FieldChecklistAnswer[] | null;
  observations: string | null;
  outcome: FieldVerificationOutcome | null;
  reportRemarks: string | null;
  followUpRequested: boolean;
  submittedAt: string | null;
  submittedById: string | null;
  assignedOfficer: FieldOfficer | null;
  assignedBy: FieldOfficer | null;
  submittedBy: FieldOfficer | null;
  visitStatus: FieldVisitStatus;
};

export type FieldApplicationDetail = {
  application: {
    id: string;
    applicantName: string;
    serviceType: string;
    village: string;
    hobli: string;
    taluk: string;
    district: string;
    address: string;
    annualFamilyIncome: number | null;
    purpose: string;
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    documentStatus: string;
    workflowStage: ApplicationWorkflowStage;
    assignedCaseOfficer: { id: string; name: string; role: string } | null;
  };
  eligibleForScheduling: boolean;
  blockingDocuments: { category: string; label: string }[];
  verification: FieldVerificationRecord | null;
  officers: FieldOfficer[];
  checklistItems: FieldChecklistKey[];
  history: FieldVerificationActivity[];
  aiMode: "DEMONSTRATION";
};

export type FieldReportInput = {
  checklist: FieldChecklistAnswer[];
  observations: string;
  outcome: FieldVerificationOutcome;
  remarks: string;
  followUpRequested: boolean;
};

export type FieldScheduleInput = {
  scheduledAt: string;
  village: string;
  address: string;
  instructions: string;
  internalNotes: string;
};

export class FieldVerificationApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FieldVerificationApiError";
  }
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    demoOfficerId?: string;
  } = {},
): Promise<T> {
  const headers = new Headers();
  if (isDocumentDemoAuthEnabled()) {
    headers.set("X-Janaseva-Demo-Auth", "enabled");
    if (options.demoOfficerId) {
      headers.set("X-Janaseva-Demo-Field-Officer", options.demoOfficerId);
    }
  }
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      headers,
      credentials: "same-origin",
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch {
    if (isDemoModeEnabled()) {
      const demoResponse = getDemoApiResponse(path, {
        method: options.method,
      });
      if (demoResponse !== null) return demoResponse as T;
    }
    if (controller.signal.aborted) {
      throw new FieldVerificationApiError(
        "The field verification service timed out. Please retry.",
        408,
      );
    }
    throw new FieldVerificationApiError(
      "Could not reach the field verification API.",
      0,
    );
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "message" in body) {
        const value = body.message;
        if (typeof value === "string") message = value;
        else if (
          Array.isArray(value) &&
          value.every((part) => typeof part === "string")
        ) {
          message = value.join(" ");
        }
      }
    } catch {
      // Keep the HTTP status when the server does not return JSON.
    }
    const readOnlyRequest = (options.method ?? "GET").toUpperCase() === "GET";
    if (
      readOnlyRequest &&
      isDemoModeEnabled() &&
      (response.status === 401 || response.status >= 500)
    ) {
      const demoResponse = getDemoApiResponse(path, {
        method: options.method,
      });
      if (demoResponse !== null) return demoResponse as T;
    }
    throw new FieldVerificationApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new FieldVerificationApiError(
      "The field verification API returned an invalid response.",
      502,
    );
  }
}

export function getFieldQueue(parameters: URLSearchParams) {
  return request<FieldQueueResponse>(
    `/field-verification?${parameters.toString()}`,
  );
}

export function getFieldApplication(applicationId: string) {
  return request<FieldApplicationDetail>(
    `/applications/${encodeURIComponent(applicationId)}/field-verification`,
  );
}

export function assignFieldOfficer(
  applicationId: string,
  assignedOfficerId: string,
) {
  return request<FieldVerificationRecord>(
    `/applications/${encodeURIComponent(applicationId)}/field-verification/assign`,
    { method: "POST", body: { assignedOfficerId } },
  );
}

export function scheduleFieldVisit(
  applicationId: string,
  input: FieldScheduleInput,
) {
  return request<FieldVerificationRecord>(
    `/applications/${encodeURIComponent(applicationId)}/field-verification/schedule`,
    { method: "POST", body: input },
  );
}

export function rescheduleFieldVisit(
  verificationId: string,
  input: FieldScheduleInput,
) {
  return request<FieldVerificationRecord>(
    `/field-verification/${encodeURIComponent(verificationId)}/schedule`,
    { method: "PATCH", body: input },
  );
}

export function startFieldVisit(
  verificationId: string,
  options: { demoOfficerId?: string } = {},
) {
  return request<FieldVerificationRecord>(
    `/field-verification/${encodeURIComponent(verificationId)}/start`,
    { method: "POST", ...options },
  );
}

export function saveFieldDraft(
  verificationId: string,
  input: Partial<FieldReportInput>,
  options: { demoOfficerId?: string } = {},
) {
  return request<FieldVerificationRecord>(
    `/field-verification/${encodeURIComponent(verificationId)}/draft`,
    { method: "PUT", body: input, ...options },
  );
}

export function submitFieldReport(
  verificationId: string,
  input: FieldReportInput,
  options: { demoOfficerId?: string } = {},
) {
  return request<FieldVerificationRecord>(
    `/field-verification/${encodeURIComponent(verificationId)}/submit`,
    { method: "POST", body: input, ...options },
  );
}

export function requestFieldAssistance(input: {
  observations: string;
  checklist: FieldChecklistAnswer[];
}) {
  return request<{
    mode: "DEMONSTRATION";
    summary: string;
    incompleteItems: FieldChecklistKey[];
    statementsForClarification: FieldChecklistKey[];
    suggestedQuestions: string[];
    draft: { observations: string } | null;
    notice: string;
  }>("/field-verification/assist", {
    method: "POST",
    body: input,
  });
}
