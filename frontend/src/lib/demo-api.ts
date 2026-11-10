import { applications, createInitialApplicationCase } from "@/lib/demo-data";
import type {
  ApplicationWorkflowStage,
  DocumentCategory,
  DocumentStatus,
  VerificationOfficer,
} from "@/lib/document-verification-api";
import type { ApplicationDocumentStatus } from "@/lib/document-verification-api";
import type {
  FieldOfficer,
  FieldVisitStatus,
} from "@/lib/field-verification-api";

const demoOfficer: VerificationOfficer & FieldOfficer = {
  id: "demo-authorized-officer",
  name: "Demonstration Reviewer",
  role: "AUTHORIZED_OFFICER",
};

const fieldOfficer: FieldOfficer = {
  id: "demo-field-officer",
  name: "Demonstration Field Officer",
  role: "VA_RI",
};

const categoryDetails: {
  key: "identity" | "ration" | "income" | "residence" | "supporting";
  category: DocumentCategory;
  label: string;
}[] = [
  { key: "identity", category: "IDENTITY_PROOF", label: "Identity proof" },
  { key: "ration", category: "RATION_CARD", label: "Ration card" },
  {
    key: "income",
    category: "INCOME_DECLARATION",
    label: "Income declaration",
  },
  { key: "residence", category: "RESIDENCE_PROOF", label: "Residence proof" },
  {
    key: "supporting",
    category: "SUPPORTING_INCOME",
    label: "Supporting income document",
  },
];

function workflowStage(
  status: (typeof applications)[number]["status"],
): ApplicationWorkflowStage {
  if (status === "field") return "FIELD_VERIFICATION";
  if (status === "review") return "FINAL_REVIEW";
  if (status === "approved" || status === "rejected" || status === "returned") {
    return "COMPLETED";
  }
  return "DOCUMENT_VERIFICATION";
}

function documentStatus(
  status: (typeof applications)[number]["status"],
): ApplicationDocumentStatus {
  if (status === "returned") return "DOCUMENTS_AWAITING_REPLACEMENT";
  if (status === "approved" || status === "rejected") {
    return "DOCUMENTS_VERIFIED";
  }
  if (status === "field" || status === "review") {
    return "DOCUMENTS_VERIFIED";
  }
  return "DOCUMENT_REVIEW_PENDING";
}

function priority(value: (typeof applications)[number]["priority"]) {
  return value.toUpperCase();
}

function isoDate(date: string, hour = 9) {
  return `${date}T${String(hour).padStart(2, "0")}:00:00.000Z`;
}

function listItem(application: (typeof applications)[number]) {
  const stage = workflowStage(application.status);
  return {
    id: application.id,
    applicationId: application.id,
    applicantName: application.applicant.en,
    village: application.village.en,
    submissionDate: isoDate(application.date),
    serviceType: "Income Certificate",
    status: documentStatus(application.status),
    decisionStatus:
      application.status === "approved"
        ? "APPROVED"
        : application.status === "rejected"
          ? "REJECTED"
          : application.status === "returned"
            ? "RETURNED_FOR_CORRECTION"
            : null,
    workflowStage: stage,
    priority: priority(application.priority),
    assignedOfficer: { ...demoOfficer },
  };
}

function pageOf<T>(items: T[], url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(
    1,
    Math.min(100, Number(url.searchParams.get("pageSize")) || 20),
  );
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
  };
}

function matchingApplications(url: URL) {
  const search = url.searchParams.get("search")?.toLocaleLowerCase() ?? "";
  const status = url.searchParams.get("status");
  return applications.filter((application) => {
    const matchesSearch =
      !search ||
      `${application.id} ${application.applicant.en} ${application.village.en}`
        .toLocaleLowerCase()
        .includes(search);
    const mappedStatus = documentStatus(application.status);
    const matchesStatus =
      !status ||
      status === "all" ||
      status === mappedStatus ||
      status === application.status.toUpperCase();
    return matchesSearch && matchesStatus;
  });
}

function applicationDetail(id: string) {
  const application = applications.find((item) => item.id === id);
  if (!application) return null;
  const detail = createInitialApplicationCase(application);
  return { application, detail };
}

function demoDocuments(id: string) {
  const result = applicationDetail(id);
  if (!result) return null;
  const { application, detail } = result;
  const records = categoryDetails.map(({ key, category, label }, index) => {
    const source = detail.documents.find((item) => item.key === key);
    const status: DocumentStatus = !source?.uploaded
      ? "MISSING"
      : source.verification === "verified"
        ? "VERIFIED"
        : source.verification === "rejected"
          ? "REJECTED"
          : "PENDING_VERIFICATION";
    const version = source?.uploaded
      ? {
          id: `${source.id}-version-1`,
          version: 1,
          originalFilename: `${key}-demo.pdf`,
          mimeType: "application/pdf",
          sizeBytes: 120_000 + index * 1_000,
          status,
          uploadedAt: isoDate(application.date, 10 + index),
          uploadedBy: { id: "demo-applicant", name: application.applicant.en },
          verifiedBy: status === "VERIFIED" ? { ...demoOfficer } : null,
          verifiedAt:
            status === "VERIFIED" ? isoDate(application.date, 11) : null,
          remarks: null,
          rejectionReason:
            status === "REJECTED" ? "Please provide a clearer copy." : null,
          replacementReason: null,
        }
      : null;
    return {
      id: source?.uploaded ? source.id : null,
      applicationId: application.id,
      category,
      label,
      required: true,
      status,
      requiredReason: null,
      requestedAt: null,
      versions: version ? [version] : [],
      currentVersion: version,
      isVirtual: !source?.uploaded,
    };
  });
  return {
    application: {
      id: application.id,
      applicantName: application.applicant.en,
      village: application.village.en,
      submissionDate: isoDate(application.date),
      assignedOfficer: { ...demoOfficer },
      status: documentStatus(application.status),
      workflowStage: workflowStage(application.status),
    },
    documents: records,
    requirements: records.map(({ category, label, required }) => ({
      category,
      label,
      required,
    })),
  };
}

function verificationQueue(url: URL) {
  const items = matchingApplications(url).map((application) => {
    const documentSet = demoDocuments(application.id);
    const documents = documentSet?.documents ?? [];
    const pendingCount = documents.filter(
      (item) => item.status === "PENDING_VERIFICATION",
    ).length;
    const verifiedCount = documents.filter(
      (item) => item.status === "VERIFIED",
    ).length;
    const missingCount = documents.filter(
      (item) => item.status === "MISSING",
    ).length;
    const replacementCount = 0;
    return {
      applicationId: application.id,
      applicantName: application.applicant.en,
      village: application.village.en,
      submissionDate: isoDate(application.date),
      documentCount: documents.filter((item) => item.currentVersion).length,
      verifiedCount,
      pendingCount,
      replacementCount,
      missingCount,
      status: documentStatus(application.status),
      assignedOfficer: { id: demoOfficer.id, name: demoOfficer.name },
      workflowStage: workflowStage(application.status),
      lastUpdated: isoDate(application.date, 16),
    };
  });
  const paged = pageOf(items, url);
  return {
    ...paged,
    summary: {
      documentsReceived: items.reduce(
        (sum, item) => sum + item.documentCount,
        0,
      ),
      pending: items.reduce((sum, item) => sum + item.pendingCount, 0),
      verified: items.reduce((sum, item) => sum + item.verifiedCount, 0),
      replacementRequested: items.reduce(
        (sum, item) => sum + item.replacementCount,
        0,
      ),
      missing: items.reduce((sum, item) => sum + item.missingCount, 0),
    },
  };
}

function fieldQueue(url: URL) {
  const items = matchingApplications(url)
    .filter((application) => application.status === "field")
    .map((application) => {
      const detail = applicationDetail(application.id)?.detail;
      return {
        applicationId: application.id,
        applicantName: application.applicant.en,
        village: application.village.en,
        hobli: detail?.hobli.en ?? "",
        taluk: detail?.taluk.en ?? "",
        district: detail?.district.en ?? "",
        submissionDate: isoDate(application.date),
        documentStatus: documentStatus(application.status),
        workflowStage: "FIELD_VERIFICATION" as const,
        eligibleForScheduling: true,
        blockingDocuments: [],
        assignedOfficer: { ...fieldOfficer },
        scheduledAt: isoDate(application.date, 14),
        visitStatus: "SCHEDULED" as FieldVisitStatus,
        priority: priority(application.priority),
      };
    });
  return {
    ...pageOf(items, url),
    officers: [{ ...fieldOfficer }],
    summary: {
      totalCases: items.length,
      pendingVisits: 0,
      scheduledVisits: items.length,
      inProgressVisits: 0,
      reportsSubmitted: 0,
      furtherVerification: 0,
      overdueVisits: 0,
    },
  };
}

function finalReviewQueue(url: URL) {
  const items = matchingApplications(url)
    .filter((application) => application.status === "review")
    .map((application) => ({
      ...listItem(application),
      fieldVerificationStatus: "SUBMITTED" as const,
      fieldOfficer: { ...fieldOfficer },
      latestDecision: null,
      eligible: true,
      blockers: [],
      missingRequiredDocuments: [],
    }));
  return {
    ...pageOf(items, url),
    reviewers: [{ ...demoOfficer }],
  };
}

function dashboardReport(url: URL) {
  const items = matchingApplications(url).map((application) => ({
    ...listItem(application),
    assignedOfficer: { ...demoOfficer },
  }));
  const summary = {
    totalApplications: applications.length,
    pendingApplications: applications.filter(
      (item) => item.status !== "approved" && item.status !== "rejected",
    ).length,
    requiresAttention: applications.filter(
      (item) => item.status === "documents" || item.status === "returned",
    ).length,
    documentReviewPending: applications.filter(
      (item) => item.status === "documents",
    ).length,
    fieldVerification: applications.filter((item) => item.status === "field")
      .length,
    completedWorkflow: applications.filter(
      (item) =>
        item.status === "approved" ||
        item.status === "rejected" ||
        item.status === "returned",
    ).length,
    applicationDecisions: applications.filter(
      (item) => item.status === "approved" || item.status === "rejected",
    ).length,
    approvedApplications: applications.filter(
      (item) => item.status === "approved",
    ).length,
    rejectedApplications: applications.filter(
      (item) => item.status === "rejected",
    ).length,
    returnedApplications: applications.filter(
      (item) => item.status === "returned",
    ).length,
    overdueApplications: null,
  };
  const paged = pageOf(items, url);
  return {
    ...paged,
    summary,
    documentStatusBreakdown: [
      {
        status: "DOCUMENT_REVIEW_PENDING" as const,
        count: summary.documentReviewPending,
      },
      {
        status: "DOCUMENTS_VERIFIED" as const,
        count: applications.length - summary.documentReviewPending,
      },
    ],
    workflowStageBreakdown: [
      {
        workflowStage: "DOCUMENT_VERIFICATION" as const,
        count: summary.documentReviewPending,
      },
      {
        workflowStage: "FIELD_VERIFICATION" as const,
        count: summary.fieldVerification,
      },
      {
        workflowStage: "FINAL_REVIEW" as const,
        count: applications.filter((item) => item.status === "review").length,
      },
      {
        workflowStage: "COMPLETED" as const,
        count: summary.completedWorkflow,
      },
    ],
    officerWorkload: [
      { officer: { ...demoOfficer }, count: summary.pendingApplications },
    ],
    submissionsByDay: applications.map((item) => ({
      date: item.date,
      count: 1,
    })),
    filters: {
      officers: [{ ...demoOfficer }, { ...fieldOfficer }],
      serviceTypes: ["Income Certificate"],
    },
  };
}

function dashboardHistory(url: URL) {
  const items = applications.flatMap((application) =>
    createInitialApplicationCase(application).history.map((event) => ({
      id: event.id,
      category: "APPLICATION" as const,
      applicationId: application.id,
      applicantName: application.applicant.en,
      village: application.village.en,
      action: event.key,
      occurredAt: event.date,
      officerId: demoOfficer.id,
      officerName: demoOfficer.name,
      officerRole: demoOfficer.role,
      previousStatus: null,
      newStatus: documentStatus(application.status),
      remarks: event.comment ?? null,
      details: null,
      documentId: null,
      documentCategory: null,
      documentLabel: null,
      fieldVerificationId: null,
      applicationStatus: documentStatus(application.status),
      workflowStage: workflowStage(application.status),
      serviceType: "Income Certificate",
    })),
  );
  const paged = pageOf(items, url);
  return {
    ...paged,
    summary: {
      total: items.length,
      applicationSubmissions: applications.length,
      documentUploads: applications.length * 4,
      documentVerifications: applications.length * 2,
      fieldVisitsScheduled: applications.filter(
        (item) => item.status === "field",
      ).length,
      fieldReportsSubmitted: applications.filter(
        (item) => item.status === "review",
      ).length,
    },
  };
}

function finalReviewApplication(id: string) {
  const result = applicationDetail(id);
  if (!result) return null;
  const { application, detail } = result;
  return {
    application: {
      ...listItem(application),
      hobli: detail.hobli.en,
      taluk: detail.taluk.en,
      district: detail.district.en,
      address: detail.address.en,
      annualFamilyIncome: detail.annualIncome,
      applicationPurpose: detail.purpose.en,
      fieldVerificationStatus: "SUBMITTED" as const,
      fieldOfficer: { ...fieldOfficer },
      latestDecision: null,
    },
    fieldVerification: {
      id: `${id}-field-verification`,
      status: "SUBMITTED" as const,
      assignedOfficer: { ...fieldOfficer },
      scheduledAt: isoDate(application.date, 14),
      visitVillage: application.village.en,
      visitAddress: detail.address.en,
      checklist: null,
      observations: "Synthetic demonstration visit completed.",
      outcome: "INFORMATION_SUPPORTED" as const,
      reportRemarks: null,
      followUpRequested: false,
      submittedAt: isoDate(application.date, 16),
      submittedBy: { ...fieldOfficer },
    },
    missingRequests: [],
    decisions: [],
    eligibility: {
      allowed: true,
      blockers: [],
      missingRequiredDocuments: [],
    },
  };
}

export function getDemoApiResponse(path: string, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const url = new URL(path, "http://demo.local");
  const pathname = url.pathname;
  if (
    method !== "GET" &&
    !(method === "POST" && /\/ai-analysis$/.test(pathname))
  ) {
    return null;
  }
  const applicationMatch = pathname.match(/^\/applications\/([^/]+)\/(.+)$/);
  const applicationId = applicationMatch
    ? decodeURIComponent(applicationMatch[1])
    : "";
  const endpoint = applicationMatch?.[2];

  if (pathname === "/applications") {
    return {
      ...pageOf(matchingApplications(url).map(listItem), url),
    };
  }
  if (pathname === "/document-verification") return verificationQueue(url);
  if (pathname === "/document-verification/officers") {
    return [{ ...demoOfficer }, { ...fieldOfficer }];
  }
  if (pathname === "/field-verification") return fieldQueue(url);
  if (pathname === "/final-review") return finalReviewQueue(url);
  if (pathname === "/reports") return dashboardReport(url);
  if (pathname === "/history") return dashboardHistory(url);
  if (pathname === "/settings/profile") {
    return {
      officer: { ...demoOfficer },
      account: { status: "ACTIVE", authentication: "DEMONSTRATION" },
      organization: {
        department: "Revenue Department",
        district: "Shivamogga",
      },
      application: {
        name: "Janaseva AI",
        version: "Demonstration",
        officialPortal: false,
      },
    };
  }
  if (pathname === "/ai/provider-status") {
    return {
      provider: "Groq",
      model: "Demonstration only",
      status: "UNAVAILABLE",
      reason: "AI analysis is unavailable in offline demonstration mode.",
    };
  }
  if (endpoint === "documents") return demoDocuments(applicationId);
  if (endpoint === "document-history") return [];
  if (endpoint === "field-verification") {
    const result = applicationDetail(applicationId);
    if (!result) return null;
    const { application, detail } = result;
    return {
      application: {
        id: applicationId,
        applicantName: application.applicant.en,
        serviceType: "Income Certificate",
        village: application.village.en,
        hobli: detail.hobli.en,
        taluk: detail.taluk.en,
        district: detail.district.en,
        address: detail.address.en,
        annualFamilyIncome: detail.annualIncome,
        purpose: detail.purpose.en,
        priority: priority(application.priority),
        documentStatus: documentStatus(application.status),
        workflowStage: workflowStage(application.status),
        assignedCaseOfficer: { ...demoOfficer },
      },
      eligibleForScheduling: true,
      blockingDocuments: [],
      verification: {
        id: `${applicationId}-field-verification`,
        applicationId,
        assignedOfficerId: fieldOfficer.id,
        assignedById: demoOfficer.id,
        scheduledAt: isoDate(application.date, 14),
        visitVillage: application.village.en,
        visitAddress: detail.address.en,
        instructions: "Demonstration visit only.",
        internalNotes: null,
        status: "SCHEDULED",
        checklist: null,
        observations: null,
        outcome: null,
        reportRemarks: null,
        followUpRequested: false,
        submittedAt: null,
        submittedById: null,
        assignedOfficer: { ...fieldOfficer },
        assignedBy: { ...demoOfficer },
        submittedBy: null,
        visitStatus: "SCHEDULED",
      },
      officers: [{ ...fieldOfficer }],
      checklistItems: [
        "RESIDENTIAL_ADDRESS_CHECKED",
        "RESIDENCE_CONFIRMED",
        "HOUSEHOLD_COMPOSITION_CHECKED",
        "INCOME_INFORMATION_DISCUSSED",
        "INCOME_SOURCES_RECORDED",
        "SUPPORTING_INFORMATION_REVIEWED",
        "APPLICANT_INTERACTION_COMPLETED",
      ],
      history: [],
      aiMode: "DEMONSTRATION",
    };
  }
  if (endpoint === "final-review") return finalReviewApplication(applicationId);
  if (endpoint === "ai-analysis") {
    return {
      summary: "AI advisory analysis is unavailable in offline demo mode.",
      missingInformation: [],
      potentialInconsistencies: [],
      documentObservations: [],
      fieldVerificationObservations: [],
      suggestedQuestions: [],
      officerAttentionPoints: [],
      disclaimer: "AI is advisory only. The officer retains final authority.",
    };
  }

  return null;
}
