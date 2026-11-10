export type DocumentStatus =
  | "MISSING"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED"
  | "REPLACEMENT_REQUESTED";

export type ApplicationDocumentStatus =
  | "DOCUMENT_REVIEW_PENDING"
  | "DOCUMENTS_VERIFIED"
  | "DOCUMENTS_AWAITING_REPLACEMENT"
  | "DOCUMENTS_INCOMPLETE"
  | "DOCUMENTS_REJECTED";

export type ApplicationWorkflowStage =
  "DOCUMENT_VERIFICATION" | "FIELD_VERIFICATION" | "FINAL_REVIEW" | "COMPLETED";

export type DocumentCategory =
  | "IDENTITY_PROOF"
  | "RATION_CARD"
  | "INCOME_DECLARATION"
  | "RESIDENCE_PROOF"
  | "SUPPORTING_INCOME"
  | "CASTE_CERTIFICATE"
  | "OTHER";

export type VerificationQueueItem = {
  applicationId: string;
  applicantName: string;
  village: string;
  submissionDate: string;
  documentCount: number;
  verifiedCount: number;
  pendingCount: number;
  replacementCount: number;
  missingCount: number;
  status: ApplicationDocumentStatus;
  assignedOfficer: { id: string; name: string } | null;
  workflowStage: ApplicationWorkflowStage;
  lastUpdated: string | null;
};

export type VerificationOfficer = { id: string; name: string; role: string };

export type VerificationQueue = {
  items: VerificationQueueItem[];
  summary: {
    documentsReceived: number;
    pending: number;
    verified: number;
    replacementRequested: number;
    missing: number;
  };
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type DocumentVersion = {
  id: string;
  version: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  uploadedAt: string;
  uploadedBy: { id: string; name: string };
  verifiedBy: { id: string; name: string } | null;
  verifiedAt: string | null;
  remarks: string | null;
  rejectionReason: string | null;
  replacementReason: string | null;
};

export type ApplicationDocumentRecord = {
  id: string | null;
  applicationId: string;
  category: DocumentCategory;
  label: string;
  required: boolean;
  status: DocumentStatus;
  requiredReason: string | null;
  requestedAt: string | null;
  versions: DocumentVersion[];
  currentVersion: DocumentVersion | null;
  isVirtual?: boolean;
};

export type ApplicationDocuments = {
  application: {
    id: string;
    applicantName: string;
    village: string;
    submissionDate: string;
    assignedOfficer: { id: string; name: string } | null;
    status: ApplicationDocumentStatus;
    workflowStage: ApplicationWorkflowStage;
  };
  documents: ApplicationDocumentRecord[];
  requirements: {
    category: DocumentCategory;
    label: string;
    required: boolean;
  }[];
};

export type ApplicationQueueItem = {
  id: string;
  applicantName: string;
  village: string;
  submissionDate: string;
  serviceType: string;
  status: ApplicationDocumentStatus;
  decisionStatus: "APPROVED" | "REJECTED" | "RETURNED_FOR_CORRECTION" | null;
  workflowStage: ApplicationWorkflowStage;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  assignedOfficer: { id: string; name: string; role: string } | null;
};

export type ApplicationList = {
  items: ApplicationQueueItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type VerifyDocumentResult = {
  document: string;
  version: {
    id: string;
    status: DocumentStatus;
    verifiedAt: string | null;
    remarks: string | null;
  };
  application: {
    id: string;
    status: ApplicationDocumentStatus;
    workflowStage: ApplicationWorkflowStage;
  };
};

export type DocumentActivity = {
  id: string;
  applicationId: string;
  documentId: string | null;
  action: string;
  previousStatus: DocumentStatus | null;
  newStatus: DocumentStatus | null;
  officerId: string;
  timestamp: string;
  remarks: string | null;
  officer: { id: string; name: string; role: string };
  document: {
    id: string;
    category: DocumentCategory;
    label: string;
  } | null;
};

export class DocumentApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "DocumentApiError";
  }
}

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ??
  "http://localhost:3002";
const requestTimeoutMs = 15_000;
const uploadTimeoutMs = 60_000;

function getOfficerAuthHeaders(token: string, initial?: HeadersInit): Headers {
  const headers = new Headers(initial);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else if (isDocumentDemoAuthEnabled()) {
    headers.set("X-Janaseva-Demo-Auth", "enabled");
  } else {
    throw new DocumentApiError("Officer authentication is required.", 401);
  }
  return headers;
}

export function isDocumentDemoAuthEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DOCUMENT_VERIFICATION_DEMO_AUTH !== "false"
  );
}

async function request<T>(
  token: string,
  path: string,
  init: RequestInit = {},
  responseType: "json" | "blob" = "json",
  timeoutMs = requestTimeoutMs,
): Promise<T> {
  let response: Response;
  const headers = getOfficerAuthHeaders(token, init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetch(`${apiBase}/api${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = "";
      let code: string | undefined;
      let retryAfterSeconds: number | undefined;
      try {
        const body: unknown = await response.json();
        if (typeof body === "object" && body !== null) {
          if ("message" in body && typeof body.message === "string") {
            message = body.message;
          }
          if ("code" in body && typeof body.code === "string") {
            code = body.code;
          }
          if (
            "retryAfterSeconds" in body &&
            typeof body.retryAfterSeconds === "number" &&
            Number.isFinite(body.retryAfterSeconds)
          ) {
            retryAfterSeconds = Math.max(
              0,
              Math.min(86_400, Math.floor(body.retryAfterSeconds)),
            );
          }
        }
      } catch {
        message = "";
      }
      throw new DocumentApiError(
        message || "request",
        response.status,
        code,
        retryAfterSeconds,
      );
    }
    if (response.status === 204) return undefined as T;
    if (responseType === "blob") return (await response.blob()) as T;
    try {
      return (await response.json()) as T;
    } catch {
      if (controller.signal.aborted) {
        throw new DocumentApiError("timeout", 408);
      }
      throw new DocumentApiError("invalidResponse", 502);
    }
  } catch (cause) {
    if (cause instanceof DocumentApiError) throw cause;
    if (controller.signal.aborted) {
      throw new DocumentApiError("timeout", 408);
    }
    throw new DocumentApiError(
      `Could not reach the document API at ${apiBase}.`,
      0,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function requestOfficerApi<T>(
  token: string,
  path: string,
  init: RequestInit = {},
  responseType: "json" | "blob" = "json",
  timeoutMs = requestTimeoutMs,
) {
  return request<T>(token, path, init, responseType, timeoutMs);
}

export function getVerificationQueue(
  token: string,
  parameters: URLSearchParams,
) {
  return request<unknown>(
    token,
    `/document-verification?${parameters.toString()}`,
  ).then((value) => {
    if (
      typeof value !== "object" ||
      value === null ||
      !("items" in value) ||
      !Array.isArray(value.items) ||
      !("summary" in value) ||
      typeof value.summary !== "object" ||
      value.summary === null ||
      !("page" in value) ||
      typeof value.page !== "number" ||
      !("pageSize" in value) ||
      typeof value.pageSize !== "number" ||
      !("total" in value) ||
      typeof value.total !== "number" ||
      !("totalPages" in value) ||
      typeof value.totalPages !== "number"
    ) {
      throw new DocumentApiError("invalidResponse", 502);
    }
    return value as VerificationQueue;
  });
}

export function getVerificationOfficers(token: string) {
  return request<VerificationOfficer[]>(
    token,
    "/document-verification/officers",
  );
}

export function getApplications(token: string, parameters: URLSearchParams) {
  return request<unknown>(token, `/applications?${parameters.toString()}`).then(
    (value) => {
      if (
        typeof value !== "object" ||
        value === null ||
        !("items" in value) ||
        !Array.isArray(value.items) ||
        !("page" in value) ||
        typeof value.page !== "number" ||
        !("pageSize" in value) ||
        typeof value.pageSize !== "number" ||
        !("total" in value) ||
        typeof value.total !== "number" ||
        !("totalPages" in value) ||
        typeof value.totalPages !== "number"
      ) {
        throw new DocumentApiError("invalidResponse", 502);
      }
      return value as ApplicationList;
    },
  );
}

export function getApplicationDocuments(token: string, applicationId: string) {
  return request<unknown>(
    token,
    `/applications/${encodeURIComponent(applicationId)}/documents`,
  ).then((value) => {
    if (
      typeof value !== "object" ||
      value === null ||
      !("application" in value) ||
      typeof value.application !== "object" ||
      value.application === null ||
      !("documents" in value) ||
      !Array.isArray(value.documents) ||
      !("requirements" in value) ||
      !Array.isArray(value.requirements)
    ) {
      throw new DocumentApiError("invalidResponse", 502);
    }
    return value as ApplicationDocuments;
  });
}

export function getApplicationHistory(token: string, applicationId: string) {
  return request<unknown>(
    token,
    `/applications/${encodeURIComponent(applicationId)}/document-history`,
  ).then((value) => {
    if (!Array.isArray(value)) {
      throw new DocumentApiError("invalidResponse", 502);
    }
    return value as DocumentActivity[];
  });
}

export function uploadApplicationDocument(
  token: string,
  applicationId: string,
  file: File,
  category: DocumentCategory,
  label: string,
  onProgress: (progress: number) => void,
): Promise<unknown> {
  const form = new FormData();
  form.set("file", file);
  form.set("category", category);
  if (label) form.set("label", label);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${apiBase}/api/applications/${encodeURIComponent(applicationId)}/documents`,
    );
    let headers: Headers;
    try {
      headers = getOfficerAuthHeaders(token);
    } catch (cause) {
      reject(cause);
      return;
    }
    headers.forEach((value, name) => xhr.setRequestHeader(name, value));
    xhr.timeout = uploadTimeoutMs;
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        let message = "request";
        try {
          const body: unknown = JSON.parse(xhr.responseText);
          if (
            typeof body === "object" &&
            body !== null &&
            "message" in body &&
            typeof body.message === "string"
          ) {
            message = body.message;
          }
        } catch {
          message = "request";
        }
        reject(new DocumentApiError(message, xhr.status));
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText) as unknown);
      } catch {
        reject(new DocumentApiError("response", xhr.status));
      }
    });
    xhr.addEventListener("error", () =>
      reject(
        new DocumentApiError(
          `Could not reach the document API at ${apiBase}.`,
          0,
        ),
      ),
    );
    xhr.addEventListener("timeout", () =>
      reject(new DocumentApiError("timeout", 408)),
    );
    xhr.send(form);
  });
}

export function verifyDocument(
  token: string,
  documentId: string,
  remarks?: string,
) {
  return request<VerifyDocumentResult>(
    token,
    `/documents/${encodeURIComponent(documentId)}/verify`,
    {
      method: "POST",
      body: JSON.stringify({ remarks }),
    },
  );
}

export function rejectDocument(
  token: string,
  documentId: string,
  reason: string,
  remarks?: string,
) {
  return request(token, `/documents/${encodeURIComponent(documentId)}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason, remarks }),
  });
}

export function requestDocumentReplacement(
  token: string,
  documentId: string,
  reason: string,
  details?: string,
) {
  return request(
    token,
    `/documents/${encodeURIComponent(documentId)}/request-replacement`,
    { method: "POST", body: JSON.stringify({ reason, details }) },
  );
}

export function requestMissingDocuments(
  token: string,
  applicationId: string,
  documents: { category: DocumentCategory; label?: string; reason: string }[],
) {
  return request(
    token,
    `/applications/${encodeURIComponent(applicationId)}/request-missing-documents`,
    { method: "POST", body: JSON.stringify({ documents }) },
  );
}

export function markDocumentRequired(
  token: string,
  documentId: string,
  reason: string,
) {
  return request(
    token,
    `/documents/${encodeURIComponent(documentId)}/required`,
    { method: "PATCH", body: JSON.stringify({ required: true, reason }) },
  );
}

export async function fetchDocumentBlob(
  token: string,
  documentId: string,
  versionId?: string,
  download = false,
) {
  const query = new URLSearchParams();
  if (versionId) query.set("version", versionId);
  if (download) query.set("download", "1");
  return requestBlob(
    token,
    `/documents/${encodeURIComponent(documentId)}/preview?${query.toString()}`,
  );
}

async function requestBlob(token: string, path: string) {
  let response: Response;
  const headers = getOfficerAuthHeaders(token);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), uploadTimeoutMs);
  try {
    response = await fetch(`${apiBase}/api${path}`, {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      let message = "";
      try {
        const body: unknown = await response.json();
        if (
          typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof body.message === "string"
        ) {
          message = body.message;
        }
      } catch {
        message = "";
      }
      throw new DocumentApiError(message || "request", response.status);
    }
    return await response.blob();
  } catch (cause) {
    if (cause instanceof DocumentApiError) throw cause;
    if (controller.signal.aborted) {
      throw new DocumentApiError("timeout", 408);
    }
    throw new DocumentApiError(
      `Could not reach the document API at ${apiBase}.`,
      0,
    );
  } finally {
    clearTimeout(timeout);
  }
}
