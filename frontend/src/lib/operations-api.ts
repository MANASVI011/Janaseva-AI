import {
  DocumentApiError,
  requestOfficerApi,
} from "@/lib/document-verification-api";
import type {
  ApplicationDocumentStatus,
  ApplicationWorkflowStage,
  VerificationOfficer,
} from "@/lib/document-verification-api";

export type OperationsFilters = {
  fromDate: string;
  toDate: string;
  status: string;
  workflowStage: string;
  officerId: string;
  serviceType: string;
  search: string;
  category?: string;
};

export type ReportRecord = {
  id: string;
  applicantName: string;
  village: string;
  serviceType: string;
  submissionDate: string;
  status: ApplicationDocumentStatus;
  workflowStage: ApplicationWorkflowStage;
  priority: string;
  assignedOfficer: VerificationOfficer | null;
};

export type DashboardReport = {
  summary: {
    totalApplications: number;
    pendingApplications: number;
    requiresAttention: number;
    documentReviewPending: number;
    fieldVerification: number;
    completedWorkflow: number;
    applicationDecisions: number;
    approvedApplications: number;
    rejectedApplications: number;
    returnedApplications: number;
    overdueApplications: null;
  };
  documentStatusBreakdown: {
    status: ApplicationDocumentStatus;
    count: number;
  }[];
  workflowStageBreakdown: {
    workflowStage: ApplicationWorkflowStage;
    count: number;
  }[];
  officerWorkload: {
    officer: VerificationOfficer | null;
    count: number;
  }[];
  submissionsByDay: { date: string; count: number }[];
  filters: {
    officers: VerificationOfficer[];
    serviceTypes: string[];
  };
  items: ReportRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type HistoryRecord = {
  id: string;
  category: "APPLICATION" | "DOCUMENT" | "FIELD";
  applicationId: string;
  applicantName: string;
  village: string;
  action: string;
  occurredAt: string;
  officerId: string | null;
  officerName: string | null;
  officerRole: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  remarks: string | null;
  details: Record<string, unknown> | null;
  documentId: string | null;
  documentCategory: string | null;
  documentLabel: string | null;
  fieldVerificationId: string | null;
  applicationStatus: ApplicationDocumentStatus;
  workflowStage: ApplicationWorkflowStage;
  serviceType: string;
};

export type DashboardHistory = {
  items: HistoryRecord[];
  summary: {
    total: number;
    applicationSubmissions: number;
    documentUploads: number;
    documentVerifications: number;
    fieldVisitsScheduled: number;
    fieldReportsSubmitted: number;
  };
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type OfficerProfile = {
  officer: { id: string; name: string; role: string };
  account: {
    status: string;
    authentication: "DEMONSTRATION" | "SIGNED_OFFICER_SESSION";
  };
  organization: { department: string | null; district: string | null };
  application: {
    name: string;
    version: string | null;
    officialPortal: false;
  };
};

function queryString(
  filters: OperationsFilters,
  page: number,
  pageSize: number,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== "all") params.set(key, value);
  }
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return params.toString();
}

export function getDashboardReport(
  token: string,
  filters: OperationsFilters,
  page: number,
  pageSize: number,
) {
  return requestOfficerApi<DashboardReport>(
    token,
    `/reports?${queryString(filters, page, pageSize)}`,
  );
}

export function getDashboardHistory(
  token: string,
  filters: OperationsFilters,
  page: number,
  pageSize: number,
) {
  return requestOfficerApi<DashboardHistory>(
    token,
    `/history?${queryString(filters, page, pageSize)}`,
  );
}

export function downloadReportCsv(token: string, filters: OperationsFilters) {
  return requestOfficerApi<Blob>(
    token,
    `/reports/export?${queryString(filters, 1, 1)}`,
    { headers: { Accept: "text/csv" } },
    "blob",
  );
}

export function downloadHistoryCsv(token: string, filters: OperationsFilters) {
  return requestOfficerApi<Blob>(
    token,
    `/history/export?${queryString(filters, 1, 1)}`,
    { headers: { Accept: "text/csv" } },
    "blob",
  );
}

export function getOfficerProfile(token: string) {
  return requestOfficerApi<OfficerProfile>(token, "/settings/profile");
}

export function getOperationsErrorMessage(error: unknown, fallback: string) {
  if (error instanceof DocumentApiError && error.message === "request") {
    return fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
