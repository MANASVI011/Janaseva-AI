"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ClipboardCheck,
  FileClock,
  FileText,
  MapPinned,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { ApplicationDocumentPanel } from "@/components/dashboard/application-document-panel";
import { ApplicationAiAnalysis } from "@/components/dashboard/application-ai-analysis";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import {
  getApplicationDocuments,
  getApplicationHistory,
  type ApplicationDocuments,
  type DocumentActivity,
} from "@/lib/document-verification-api";
import {
  getFieldApplication,
  type FieldApplicationDetail,
  type FieldVerificationActivity,
} from "@/lib/field-verification-api";
import {
  getFinalReviewApplication,
  type FinalReviewApplication,
} from "@/lib/final-review-api";
import {
  getFieldChecklistLabel,
  getFieldVerificationCopy,
} from "@/lib/field-verification-i18n";

type WorkspaceData = {
  field: FieldApplicationDetail;
  documents: ApplicationDocuments;
  documentHistory: DocumentActivity[];
  finalReview: FinalReviewApplication;
};

type TimelineEntry = {
  id: string;
  timestamp: string;
  title: string;
  actor: string;
  detail: string;
};

type WorkspaceActivityLabel =
  | "documentUploaded"
  | "documentReplaced"
  | "documentVerified"
  | "documentRejected"
  | "replacementRequested"
  | "documentRequired"
  | "missingRequested"
  | "previewed"
  | "officerAssigned"
  | "officerReassigned"
  | "visitScheduled"
  | "visitRescheduled"
  | "visitStarted"
  | "draftSaved"
  | "reportSubmitted"
  | "followUpRequested";

const labels = {
  kn: {
    back: "ಅರ್ಜಿಗಳ ಪಟ್ಟಿಗೆ ಹಿಂತಿರುಗಿ",
    loading: "ಅರ್ಜಿ ವಿವರಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ…",
    retry: "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",
    applicant: "ಅರ್ಜಿದಾರರ ಮಾಹಿತಿ",
    application: "ಅರ್ಜಿ ಮಾಹಿತಿ",
    fullName: "ಪೂರ್ಣ ಹೆಸರು",
    address: "ವಿಳಾಸ",
    village: "ಗ್ರಾಮ",
    hobli: "ಹೋಬಳಿ",
    taluk: "ತಾಲ್ಲೂಕು",
    district: "ಜಿಲ್ಲೆ",
    purpose: "ಅರ್ಜಿಯ ಉದ್ದೇಶ",
    service: "ಕೋರಿರುವ ಸೇವೆ",
    income: "ವಾರ್ಷಿಕ ಕುಟುಂಬ ಆದಾಯ",
    submissionDate: "ಸಲ್ಲಿಸಿದ ದಿನಾಂಕ",
    priority: "ಆದ್ಯತೆ",
    caseworker: "ನಿಯೋಜಿತ ಪ್ರಕರಣ ಅಧಿಕಾರಿ",
    currentStatus: "ಅರ್ಜಿಯ ಸ್ಥಿತಿ",
    decisionStatus: "ಅಂತಿಮ ನಿರ್ಧಾರ",
    workflow: "ಕಾರ್ಯಪ್ರವಾಹದ ಹಂತ",
    field: "ಸ್ಥಳ ಪರಿಶೀಲನೆ ವರದಿ",
    visitStatus: "ಭೇಟಿಯ ಸ್ಥಿತಿ",
    assigned: "ನಿಯೋಜಿತ VA / RI",
    visitDate: "ಭೇಟಿ ದಿನ ಮತ್ತು ಸಮಯ",
    submittedBy: "ವರದಿ ಸಲ್ಲಿಸಿದ ಅಧಿಕಾರಿ",
    reportDate: "ವರದಿ ಸಲ್ಲಿಸಿದ ದಿನಾಂಕ",
    outcome: "ಪರಿಶೀಲನೆಯ ಫಲಿತಾಂಶ",
    checklist: "ಪರಿಶೀಲನಾ ಪಟ್ಟಿ",
    observations: "ಅಧಿಕಾರಿಯ ಸ್ಥಳ ವೀಕ್ಷಣೆಗಳು",
    remarks: "ವರದಿ ಟಿಪ್ಪಣಿಗಳು",
    followUp: "ಹೆಚ್ಚಿನ ಪರಿಶೀಲನೆ ಕೋರಲಾಗಿದೆ",
    noReport: "ಸ್ಥಳ ಪರಿಶೀಲನೆ ದಾಖಲೆ ಇನ್ನೂ ರಚಿಸಲಾಗಿಲ್ಲ.",
    noChecklist: "ಯಾವುದೇ ಪರಿಶೀಲನಾ ಅಂಶಗಳು ದಾಖಲಾಗಿಲ್ಲ.",
    noValue: "ದಾಖಲಾಗಿಲ್ಲ",
    history: "ಅರ್ಜಿ ಚಟುವಟಿಕೆ ಇತಿಹಾಸ",
    noHistory: "ಇನ್ನೂ ಯಾವುದೇ ಚಟುವಟಿಕೆ ದಾಖಲಾಗಿಲ್ಲ.",
    submitted: "ಅರ್ಜಿ ಸಲ್ಲಿಸಲಾಗಿದೆ",
    documentUploaded: "ದಾಖಲೆ ಅಪ್‌ಲೋಡ್ ಮಾಡಲಾಗಿದೆ",
    documentReplaced: "ದಾಖಲೆ ಬದಲಿಸಲಾಗಿದೆ",
    documentVerified: "ದಾಖಲೆ ಪರಿಶೀಲಿಸಲಾಗಿದೆ",
    documentRejected: "ದಾಖಲೆ ತಿರಸ್ಕರಿಸಲಾಗಿದೆ",
    replacementRequested: "ಬದಲಿ ದಾಖಲೆ ಕೋರಲಾಗಿದೆ",
    documentRequired: "ದಾಖಲೆ ಅಗತ್ಯವೆಂದು ಗುರುತಿಸಲಾಗಿದೆ",
    missingRequested: "ಕಾಣೆಯಾದ ದಾಖಲೆ ಕೋರಲಾಗಿದೆ",
    previewed: "ದಾಖಲೆ ಪೂರ್ವವೀಕ್ಷಿಸಲಾಗಿದೆ",
    officerAssigned: "ಸ್ಥಳ ಅಧಿಕಾರಿ ನಿಯೋಜಿಸಲಾಗಿದೆ",
    officerReassigned: "ಸ್ಥಳ ಅಧಿಕಾರಿ ಮರುನಿಯೋಜಿಸಲಾಗಿದೆ",
    visitScheduled: "ಭೇಟಿ ನಿಗದಿಪಡಿಸಲಾಗಿದೆ",
    visitRescheduled: "ಭೇಟಿ ಮರುನಿಗದಿಪಡಿಸಲಾಗಿದೆ",
    visitStarted: "ಸ್ಥಳ ಭೇಟಿ ಪ್ರಾರಂಭಿಸಲಾಗಿದೆ",
    draftSaved: "ವರದಿ ಕರಡು ಉಳಿಸಲಾಗಿದೆ",
    reportSubmitted: "ಸ್ಥಳ ಪರಿಶೀಲನೆ ವರದಿ ಸಲ್ಲಿಸಲಾಗಿದೆ",
    followUpRequested: "ಹೆಚ್ಚಿನ ಪರಿಶೀಲನೆ ಕೋರಲಾಗಿದೆ",
    decisionApproved: "ಅಧಿಕಾರಿ ಅರ್ಜಿಯನ್ನು ಅನುಮೋದಿಸಿದ್ದಾರೆ",
    decisionRejected: "ಅಧಿಕಾರಿ ಅರ್ಜಿಯನ್ನು ತಿರಸ್ಕರಿಸಿದ್ದಾರೆ",
    decisionReturned: "ಅಧಿಕಾರಿ ಅರ್ಜಿಯನ್ನು ತಿದ್ದುಪಡಿಗಾಗಿ ಹಿಂತಿರುಗಿಸಿದ್ದಾರೆ",
    decisionRemarks: "ನಿರ್ಧಾರದ ಕಾರಣ / ಟಿಪ್ಪಣಿ",
    decisionStatusLabels: {
      APPROVED: "ಅನುಮೋದಿಸಲಾಗಿದೆ",
      REJECTED: "ತಿರಸ್ಕರಿಸಲಾಗಿದೆ",
      RETURNED_FOR_CORRECTION: "ತಿದ್ದುಪಡಿ ಅಗತ್ಯ",
    },
    applicationId: "ಅರ್ಜಿ ಸಂಖ್ಯೆ",
    scheduledFor: "ನಿಗದಿತ ಸಮಯ",
    documentsLink: "ದಾಖಲೆ ಪರಿಶೀಲನೆ ತೆರೆಯಿರಿ",
    fieldLink: "ಸ್ಥಳ ಪರಿಶೀಲನೆ ತೆರೆಯಿರಿ",
    incomeCertificate: "ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ",
    roles: {
      CASEWORKER: "ಪ್ರಕರಣ ಅಧಿಕಾರಿ",
      VA_RI: "VA / RI",
      AUTHORIZED_OFFICER: "ಅಧಿಕೃತ ಅಧಿಕಾರಿ",
      ADMIN: "ನಿರ್ವಾಹಕರು",
    },
  },
  en: {
    back: "Back to applications",
    loading: "Loading application details…",
    retry: "Retry",
    applicant: "Applicant information",
    application: "Application information",
    fullName: "Full name",
    address: "Address",
    village: "Village",
    hobli: "Hobli",
    taluk: "Taluk",
    district: "District",
    purpose: "Application purpose",
    service: "Service requested",
    income: "Annual family income",
    submissionDate: "Submission date",
    priority: "Priority",
    caseworker: "Assigned caseworker",
    currentStatus: "Application status",
    decisionStatus: "Final decision",
    workflow: "Workflow stage",
    field: "Field verification report",
    visitStatus: "Visit status",
    assigned: "Assigned VA / RI",
    visitDate: "Visit date and time",
    submittedBy: "Report submitted by",
    reportDate: "Report submitted at",
    outcome: "Verification outcome",
    checklist: "Checklist",
    observations: "Officer's field observations",
    remarks: "Report remarks",
    followUp: "Further verification requested",
    noReport: "No field verification record has been created.",
    noChecklist: "No checklist items have been recorded.",
    noValue: "Not recorded",
    history: "Application activity history",
    noHistory: "No activity has been recorded yet.",
    submitted: "Application submitted",
    documentUploaded: "Document uploaded",
    documentReplaced: "Document replaced",
    documentVerified: "Document verified",
    documentRejected: "Document rejected",
    replacementRequested: "Replacement requested",
    documentRequired: "Document marked required",
    missingRequested: "Missing document requested",
    previewed: "Document previewed",
    officerAssigned: "Field officer assigned",
    officerReassigned: "Field officer reassigned",
    visitScheduled: "Visit scheduled",
    visitRescheduled: "Visit rescheduled",
    visitStarted: "Field visit started",
    draftSaved: "Report draft saved",
    reportSubmitted: "Field report submitted",
    followUpRequested: "Further verification requested",
    decisionApproved: "Officer approved the application",
    decisionRejected: "Officer rejected the application",
    decisionReturned: "Officer returned the application for correction",
    decisionRemarks: "Decision reason / remarks",
    decisionStatusLabels: {
      APPROVED: "Approved",
      REJECTED: "Rejected",
      RETURNED_FOR_CORRECTION: "Correction required",
    },
    applicationId: "Application ID",
    scheduledFor: "Scheduled for",
    documentsLink: "Open document verification",
    fieldLink: "Open field verification",
    incomeCertificate: "Income certificate",
    roles: {
      CASEWORKER: "Caseworker",
      VA_RI: "VA / RI",
      AUTHORIZED_OFFICER: "Authorised officer",
      ADMIN: "Administrator",
    },
  },
} as const;

const documentActivityLabels: Record<string, WorkspaceActivityLabel> = {
  DOCUMENT_UPLOADED: "documentUploaded",
  DOCUMENT_REPLACED: "documentReplaced",
  DOCUMENT_VERIFIED: "documentVerified",
  DOCUMENT_REJECTED: "documentRejected",
  REPLACEMENT_REQUESTED: "replacementRequested",
  DOCUMENT_REQUIRED: "documentRequired",
  MISSING_DOCUMENT_REQUESTED: "missingRequested",
  DOCUMENT_PREVIEWED: "previewed",
  DOCUMENT_DOWNLOADED: "previewed",
};

const fieldActivityLabels: Record<string, WorkspaceActivityLabel> = {
  OFFICER_ASSIGNED: "officerAssigned",
  OFFICER_REASSIGNED: "officerReassigned",
  VISIT_SCHEDULED: "visitScheduled",
  VISIT_RESCHEDULED: "visitRescheduled",
  VISIT_STARTED: "visitStarted",
  REPORT_DRAFT_SAVED: "draftSaved",
  FIELD_REPORT_SUBMITTED: "reportSubmitted",
  FOLLOW_UP_REQUESTED: "followUpRequested",
};

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <span className="text-teal-700">{icon}</span>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-xs font-medium leading-5 text-slate-900">
        {value}
      </dd>
    </div>
  );
}

function recordDetail(
  activity: FieldVerificationActivity,
  language: "kn" | "en",
  copy: { assigned: string; scheduledFor: string },
  scheduledFor: string,
) {
  const details = activity.details;
  if (!details) return "";
  const strings: string[] = [];
  if (typeof details.assignedOfficerName === "string") {
    strings.push(`${copy.assigned}: ${details.assignedOfficerName}`);
  }
  if (typeof details.scheduledAt === "string") {
    strings.push(`${copy.scheduledFor}: ${scheduledFor}`);
  }
  if (
    typeof details.completedChecklistItems === "number" &&
    language === "en"
  ) {
    strings.push(`${details.completedChecklistItems} checklist items saved`);
  } else if (typeof details.completedChecklistItems === "number") {
    strings.push(
      `${details.completedChecklistItems} ಪರಿಶೀಲನಾ ಅಂಶಗಳನ್ನು ಉಳಿಸಲಾಗಿದೆ`,
    );
  }
  if (typeof details.outcome === "string") {
    strings.push(
      getFieldVerificationCopy(language).outcomeLabels[
        details.outcome as keyof ReturnType<
          typeof getFieldVerificationCopy
        >["outcomeLabels"]
      ] ?? details.outcome.replaceAll("_", " "),
    );
  }
  if (typeof details.remarks === "string" && details.remarks) {
    strings.push(details.remarks);
  }
  return strings.join(" · ");
}

export function ApplicationWorkspacePage({
  applicationId,
}: {
  applicationId: string;
}) {
  const { language, t } = useDashboard();
  const copy = labels[language];
  const fieldCopy = getFieldVerificationCopy(language);
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const numberFormat = useMemo(
    () =>
      new Intl.NumberFormat(language === "kn" ? "kn-IN" : "en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }),
    [language],
  );
  const dateLabel = useCallback(
    (value: string | null | undefined) =>
      value
        ? new Intl.DateTimeFormat(language === "kn" ? "kn-IN" : "en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(value))
        : copy.noValue,
    [copy.noValue, language],
  );

  const loadWorkspace = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const [field, documents, documentHistory, finalReview] =
        await Promise.all([
          getFieldApplication(applicationId),
          getApplicationDocuments(applicationId),
          getApplicationHistory(applicationId),
          getFinalReviewApplication(applicationId),
        ]);
      if (sequence !== requestSequence.current) return;
      setData({
        field,
        documents,
        documentHistory,
        finalReview,
      });
    } catch (cause) {
      if (sequence !== requestSequence.current) return;
      setData(null);
      setError(
        cause instanceof Error
          ? cause.message
          : t.documentVerification.apiError,
      );
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [applicationId, t.documentVerification.apiError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => {
      window.clearTimeout(timer);
      requestSequence.current += 1;
    };
  }, [loadWorkspace]);

  const updateApplicationStatus = useCallback(
    (application: ApplicationDocuments["application"]) => {
      setData((current) =>
        current
          ? {
              ...current,
              field: {
                ...current.field,
                application: {
                  ...current.field.application,
                  documentStatus: application.status,
                  workflowStage: application.workflowStage,
                },
              },
            }
          : current,
      );
    },
    [],
  );

  const timeline = useMemo(() => {
    if (!data) return [];
    const entries: TimelineEntry[] = [
      {
        id: `submission:${data.documents.application.id}`,
        timestamp: data.documents.application.submissionDate,
        title: copy.submitted,
        actor: data.field.application.applicantName,
        detail: "",
      },
      ...data.documentHistory.map((event) => {
        const category = event.document
          ? t.documentVerification.category[event.document.category]
          : "";
        const documentName =
          event.document?.label ||
          (event.document
            ? t.documentVerification.category[event.document.category]
            : "");
        const titleKey = documentActivityLabels[event.action];
        const title = titleKey
          ? copy[titleKey]
          : event.action.replaceAll("_", " ");
        const status = event.newStatus
          ? t.documentVerification.documentStatus[event.newStatus]
          : "";
        return {
          id: `document:${event.id}`,
          timestamp: event.timestamp,
          title,
          actor: event.officer.name,
          detail:
            [
              documentName,
              status,
              event.remarks && event.action !== "DOCUMENT_UPLOADED"
                ? event.remarks
                : "",
            ]
              .filter(Boolean)
              .join(" · ") || category,
        };
      }),
      ...data.field.history.map((event) => {
        const titleKey = fieldActivityLabels[event.action];
        const scheduledAt =
          typeof event.details?.scheduledAt === "string"
            ? dateLabel(event.details.scheduledAt)
            : "";
        return {
          id: `field:${event.id}`,
          timestamp: event.timestamp,
          title: titleKey ? copy[titleKey] : event.action.replaceAll("_", " "),
          actor: event.officer.name,
          detail: recordDetail(event, language, copy, scheduledAt),
        };
      }),
      ...data.finalReview.decisions.map((event) => ({
        id: `decision:${event.id}`,
        timestamp: event.createdAt,
        title:
          event.decision === "APPROVE"
            ? copy.decisionApproved
            : event.decision === "REJECT"
              ? copy.decisionRejected
              : copy.decisionReturned,
        actor: event.officer.name,
        detail: event.remarks
          ? `${copy.decisionRemarks}: ${event.remarks}`
          : "",
      })),
    ];
    return entries.sort((left, right) => {
      const byTime =
        new Date(left.timestamp).getTime() -
        new Date(right.timestamp).getTime();
      return byTime || left.id.localeCompare(right.id);
    });
  }, [
    copy,
    data,
    dateLabel,
    language,
    t.documentVerification.category,
    t.documentVerification.documentStatus,
  ]);

  const current =
    data?.field.application.id === applicationId &&
    data.documents.application.id === applicationId &&
    data.finalReview.application.id === applicationId
      ? data
      : null;

  useEffect(() => {
    if (!current || window.location.hash !== "#ai-analysis") return;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById("ai-analysis")
        ?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [current]);

  const application = current?.field.application;
  const verification = current?.field.verification;
  const status =
    current &&
    t.documentVerification.applicationStatus[
      current.documents.application.status
    ];
  const priority =
    application &&
    fieldCopy.priorityLabels[
      application.priority as keyof typeof fieldCopy.priorityLabels
    ];

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/applications"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-teal-800"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            {copy.back}
          </Link>
          <p className="mt-4 font-mono text-[10px] font-semibold text-slate-500">
            {applicationId}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {application?.applicantName ?? t.applicationDetail.pageTitle}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {current && (
            <Link
              href="/document-verification"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {copy.documentsLink}
            </Link>
          )}
          {current && (
            <Link
              href="/field-verification"
              className="inline-flex h-9 items-center rounded-lg bg-[#12243d] px-3 text-xs font-medium text-white hover:bg-[#1b3555]"
            >
              {copy.fieldLink}
            </Link>
          )}
          <button
            type="button"
            onClick={() => void loadWorkspace()}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 disabled:opacity-50"
          >
            <RefreshCw size={14} aria-hidden="true" />
            {copy.retry}
          </button>
        </div>
      </header>

      {loading && !current && (
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500"
        >
          {copy.loading}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadWorkspace()}
            className="font-semibold underline"
          >
            {copy.retry}
          </button>
        </div>
      )}

      {current && application && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-teal-50 px-3 py-1 text-[10px] font-semibold text-teal-800">
              {status}
            </span>
            {current.finalReview.application.decisionStatus && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-800">
                {
                  copy.decisionStatusLabels[
                    current.finalReview.application.decisionStatus
                  ]
                }
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-medium text-slate-700">
              {fieldCopy.workflow[application.workflowStage]}
            </span>
            {priority && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-medium text-slate-700">
                {priority}
              </span>
            )}
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-2">
            <Card title={copy.applicant} icon={<UserRound size={16} />}>
              <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <Info label={copy.fullName} value={application.applicantName} />
                <Info
                  label={copy.address}
                  value={application.address || copy.noValue}
                />
                <Info
                  label={copy.village}
                  value={application.village || copy.noValue}
                />
                <Info
                  label={copy.hobli}
                  value={application.hobli || copy.noValue}
                />
                <Info
                  label={copy.taluk}
                  value={application.taluk || copy.noValue}
                />
                <Info
                  label={copy.district}
                  value={application.district || copy.noValue}
                />
                <Info
                  label={copy.caseworker}
                  value={
                    application.assignedCaseOfficer
                      ? `${application.assignedCaseOfficer.name} · ${
                          copy.roles[
                            application.assignedCaseOfficer
                              .role as keyof typeof copy.roles
                          ] ?? application.assignedCaseOfficer.role
                        }`
                      : copy.noValue
                  }
                />
              </dl>
            </Card>

            <Card title={copy.application} icon={<FileText size={16} />}>
              <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <Info label={copy.applicationId} value={application.id} />
                <Info
                  label={copy.service}
                  value={
                    application.serviceType === "INCOME_CERTIFICATE"
                      ? copy.incomeCertificate
                      : application.serviceType.replaceAll("_", " ")
                  }
                />
                <Info
                  label={copy.purpose}
                  value={application.purpose || copy.noValue}
                />
                <Info
                  label={copy.income}
                  value={
                    application.annualFamilyIncome === null
                      ? copy.noValue
                      : numberFormat.format(application.annualFamilyIncome)
                  }
                />
                <Info
                  label={copy.submissionDate}
                  value={dateLabel(
                    current.documents.application.submissionDate,
                  )}
                />
                <Info
                  label={copy.currentStatus}
                  value={
                    current.finalReview.application.decisionStatus
                      ? copy.decisionStatusLabels[
                          current.finalReview.application.decisionStatus
                        ]
                      : (status ?? copy.noValue)
                  }
                />
                <Info
                  label={copy.workflow}
                  value={fieldCopy.workflow[application.workflowStage]}
                />
              </dl>
            </Card>
          </div>

          <div id="ai-analysis">
            <ApplicationAiAnalysis applicationId={applicationId} />
          </div>

          <Card title={copy.field} icon={<MapPinned size={16} />}>
            {!verification ? (
              <p className="text-xs text-slate-500">{copy.noReport}</p>
            ) : (
              <div className="space-y-4">
                <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Info
                    label={copy.visitStatus}
                    value={fieldCopy.status[verification.status]}
                  />
                  <Info
                    label={copy.assigned}
                    value={verification.assignedOfficer?.name ?? copy.noValue}
                  />
                  <Info
                    label={copy.visitDate}
                    value={dateLabel(verification.scheduledAt)}
                  />
                  <Info
                    label={copy.submittedBy}
                    value={verification.submittedBy?.name ?? copy.noValue}
                  />
                  <Info
                    label={copy.reportDate}
                    value={dateLabel(verification.submittedAt)}
                  />
                  <Info
                    label={copy.outcome}
                    value={
                      verification.outcome
                        ? fieldCopy.outcomeLabels[verification.outcome]
                        : copy.noValue
                    }
                  />
                </dl>
                {verification.checklist?.length ? (
                  <div>
                    <h3 className="mb-2 text-[10px] font-semibold text-slate-700">
                      {copy.checklist}
                    </h3>
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                      {verification.checklist.map((answer) => (
                        <li
                          key={answer.key}
                          className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <span className="text-xs text-slate-800">
                            {getFieldChecklistLabel(language, answer.key)}
                          </span>
                          <span className="text-[10px] font-medium text-slate-600">
                            {answer.status === "VERIFIED"
                              ? fieldCopy.verified
                              : answer.status === "NOT_VERIFIED"
                                ? fieldCopy.notVerified
                                : fieldCopy.unable}
                            {answer.remarks ? ` · ${answer.remarks}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">{copy.noChecklist}</p>
                )}
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Info
                    label={copy.observations}
                    value={verification.observations || copy.noValue}
                  />
                  <Info
                    label={copy.remarks}
                    value={verification.reportRemarks || copy.noValue}
                  />
                  {verification.followUpRequested && (
                    <Info
                      label={copy.followUp}
                      value={fieldCopy.status.FOLLOW_UP}
                    />
                  )}
                  {verification.submittedBy && (
                    <Info
                      label={copy.submittedBy}
                      value={`${verification.submittedBy.name} · ${
                        copy.roles[
                          verification.submittedBy
                            .role as keyof typeof copy.roles
                        ] ?? verification.submittedBy.role
                      }`}
                    />
                  )}
                </dl>
              </div>
            )}
          </Card>

          <ApplicationDocumentPanel
            applicationId={applicationId}
            onApplicationStatus={updateApplicationStatus}
          />

          <Card title={copy.history} icon={<FileClock size={16} />}>
            {timeline.length === 0 ? (
              <p className="text-xs text-slate-500">{copy.noHistory}</p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {timeline.map((entry) => (
                  <li
                    key={entry.id}
                    className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800">
                        {entry.title}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {entry.actor}
                        {entry.detail ? ` · ${entry.detail}` : ""}
                      </p>
                    </div>
                    <time
                      dateTime={entry.timestamp}
                      className="text-[10px] text-slate-500"
                    >
                      {dateLabel(entry.timestamp)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <ClipboardCheck size={14} aria-hidden="true" />
            {language === "kn"
              ? "ಈ ಕಾರ್ಯಸ್ಥಳವು ದಾಖಲೆ ಮತ್ತು ಸ್ಥಳ ಪರಿಶೀಲನಾ APIಗಳಿಂದ ನೈಜ ಸ್ಥಿತಿಯನ್ನು ತೋರಿಸುತ್ತದೆ."
              : "This workspace shows persisted state from the document and field verification APIs."}
          </div>
        </>
      )}
    </div>
  );
}
