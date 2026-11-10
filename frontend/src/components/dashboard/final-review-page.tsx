"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  FileText,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { ApplicationDocumentPanel } from "@/components/dashboard/application-document-panel";
import { ApplicationAiAnalysis } from "@/components/dashboard/application-ai-analysis";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import {
  getApplicationDocuments,
  getApplicationHistory,
  isDocumentDemoAuthEnabled,
  DocumentApiError,
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
  getFinalReviewQueue,
  submitFinalDecision,
  type FinalDecision,
  type FinalReviewApplication,
  type FinalReviewQueue,
} from "@/lib/final-review-api";
import { getFinalReviewCopy } from "@/lib/final-review-i18n";
import {
  getFieldChecklistLabel,
  getFieldVerificationCopy,
} from "@/lib/field-verification-i18n";
import { operationLabel } from "@/lib/operations-i18n";

type ReviewData = {
  detail: FinalReviewApplication;
  documents: ApplicationDocuments;
  field: FieldApplicationDetail;
  documentHistory: DocumentActivity[];
};

type Activity = {
  id: string;
  timestamp: string;
  title: string;
  actor: string;
  detail: string;
};

const decisions: FinalDecision[] = [
  "APPROVE",
  "REJECT",
  "RETURN_FOR_CORRECTION",
];

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

function getErrorMessage(
  cause: unknown,
  copy: ReturnType<typeof getFinalReviewCopy>,
  context: "queue" | "application" = "application",
) {
  if (cause instanceof DocumentApiError) {
    if (cause.status === 401) return copy.authError;
    if (cause.status === 403) return copy.roleDenied;
    if (cause.status === 404)
      return context === "queue" ? copy.queueUnavailable : copy.notFound;
    if (cause.status === 408) return copy.timeout;
    if (cause.status === 409) return copy.conflictError;
    if (cause.status === 400) return copy.invalidRequest;
    if (cause.status === 0) return copy.connectionError;
    return `${copy.connectionError} (${cause.status}: ${cause.message})`;
  }
  return cause instanceof Error ? cause.message : copy.connectionError;
}

export function FinalReviewPage() {
  const { documentApiToken, language, t } = useDashboard();
  const copy = getFinalReviewCopy(language);
  const fieldCopy = getFieldVerificationCopy(language);
  const documentActionNames = t.documentVerification.page.actionName;
  const [queue, setQueue] = useState<FinalReviewQueue | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [review, setReview] = useState<ReviewData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [selectedDecision, setSelectedDecision] =
    useState<FinalDecision | null>(null);
  const [remarks, setRemarks] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const [demoReviewerId, setDemoReviewerId] = useState("");
  const requestId = useRef(0);

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

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    setQueueError("");
    try {
      const result = await getFinalReviewQueue(documentApiToken, search);
      setQueue(result);
      setDemoReviewerId((current) =>
        current && result.reviewers.some((reviewer) => reviewer.id === current)
          ? current
          : "",
      );
      setSelectedId((current) =>
        current && result.items.some((item) => item.id === current)
          ? current
          : (result.items[0]?.id ?? current),
      );
    } catch (cause) {
      setQueueError(getErrorMessage(cause, copy, "queue"));
    } finally {
      setQueueLoading(false);
    }
  }, [copy, documentApiToken, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadQueue(), 150);
    return () => window.clearTimeout(timer);
  }, [loadQueue]);

  const loadReview = useCallback(async () => {
    if (!selectedId) {
      setReview(null);
      return;
    }
    const request = ++requestId.current;
    setDetailLoading(true);
    setDetailError("");
    try {
      const [detail, documents, field, documentHistory] = await Promise.all([
        getFinalReviewApplication(documentApiToken, selectedId),
        getApplicationDocuments(documentApiToken, selectedId),
        getFieldApplication(selectedId, documentApiToken),
        getApplicationHistory(documentApiToken, selectedId),
      ]);
      if (request !== requestId.current) return;
      setReview({ detail, documents, field, documentHistory });
    } catch (cause) {
      if (request !== requestId.current) return;
      setReview(null);
      setDetailError(getErrorMessage(cause, copy));
    } finally {
      if (request === requestId.current) setDetailLoading(false);
    }
  }, [copy, documentApiToken, selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadReview(), 0);
    return () => {
      window.clearTimeout(timer);
      requestId.current += 1;
    };
  }, [loadReview]);

  const activity = useMemo((): Activity[] => {
    if (!review) return [];
    const { detail, documentHistory, field } = review;
    const result: Activity[] = [
      {
        id: `submission:${detail.application.id}`,
        timestamp: detail.application.submissionDate,
        title: copy.applicationSubmitted,
        actor: detail.application.applicantName,
        detail: "",
      },
      ...documentHistory.map((event) => ({
        id: `document:${event.id}`,
        timestamp: event.timestamp,
        title:
          documentActionNames[
            event.action as keyof typeof documentActionNames
          ] ?? event.action.replaceAll("_", " "),
        actor: event.officer.name,
        detail: event.remarks ?? "",
      })),
      ...field.history.map((event: FieldVerificationActivity) => ({
        id: `field:${event.id}`,
        timestamp: event.timestamp,
        title: operationLabel(language, "action", event.action),
        actor: event.officer.name,
        detail:
          typeof event.details?.remarks === "string"
            ? event.details.remarks
            : "",
      })),
      ...detail.decisions.map((event) => ({
        id: `decision:${event.id}`,
        timestamp: event.createdAt,
        title:
          copy.actionLabels[
            event.decision === "APPROVE"
              ? "APPLICATION_APPROVED"
              : event.decision === "REJECT"
                ? "APPLICATION_REJECTED"
                : "APPLICATION_RETURNED_FOR_CORRECTION"
          ],
        actor: event.officer.name,
        detail: event.remarks ?? "",
      })),
    ];
    return result.sort(
      (left, right) =>
        new Date(left.timestamp).getTime() -
        new Date(right.timestamp).getTime(),
    );
  }, [copy, language, review, documentActionNames]);

  const current =
    review?.detail.application.id === selectedId &&
    review.documents.application.id === selectedId
      ? review
      : null;
  const application = current?.detail.application;
  const report = current?.field.verification;
  const demoMode = !documentApiToken && isDocumentDemoAuthEnabled();
  const canDecide =
    application?.workflowStage === "FINAL_REVIEW" &&
    Boolean(current?.detail.eligibility.allowed) &&
    (!demoMode || Boolean(demoReviewerId));

  function chooseDecision(decision: FinalDecision) {
    setSelectedDecision(decision);
    setRemarks("");
    setDecisionError("");
    setSavedNotice("");
  }

  async function confirmDecision() {
    if (!selectedId || !selectedDecision) return;
    if (selectedDecision !== "APPROVE" && remarks.trim().length === 0) {
      setDecisionError(copy.remarksRequired);
      return;
    }
    if (demoMode && !demoReviewerId) {
      setDecisionError(copy.reviewerRequired);
      return;
    }
    setSubmitting(true);
    setDecisionError("");
    try {
      await submitFinalDecision(
        documentApiToken,
        selectedId,
        selectedDecision,
        remarks,
        demoMode ? demoReviewerId : undefined,
      );
      setConfirming(false);
      setSelectedDecision(null);
      setSavedNotice(copy.saved);
      await Promise.all([loadReview(), loadQueue()]);
    } catch (cause) {
      setDecisionError(getErrorMessage(cause, copy));
    } finally {
      setSubmitting(false);
    }
  }

  const noOpStatusUpdate = useCallback(() => undefined, []);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-teal-800">
            {t.dashboard.eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {copy.title}
          </h1>
          <p className="mt-1 text-xs text-slate-500">{copy.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadQueue()}
          disabled={queueLoading}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 disabled:opacity-50"
        >
          <RefreshCw size={14} className={queueLoading ? "animate-spin" : ""} />
          {copy.retry}
        </button>
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(280px,0.82fr)_minmax(0,2fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {copy.queue}
            </h2>
            <label className="mt-3 block">
              <span className="sr-only">{copy.search}</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy.search}
                className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </div>
          {queueError && (
            <div
              role="alert"
              className="m-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800"
            >
              {queueError}
              <button
                type="button"
                onClick={() => void loadQueue()}
                className="ml-2 font-semibold underline"
              >
                {copy.retry}
              </button>
            </div>
          )}
          {queueLoading && !queue && (
            <p role="status" className="p-5 text-xs text-slate-500">
              {copy.loading}
            </p>
          )}
          {!queueLoading && queue?.items.length === 0 && (
            <p role="status" className="p-5 text-xs text-slate-500">
              {copy.noApplications}
            </p>
          )}
          {queue?.items.length ? (
            <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
              {queue.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setSavedNotice("");
                    }}
                    aria-current={selectedId === item.id ? "true" : undefined}
                    className={`w-full px-4 py-3 text-left transition hover:bg-slate-50 ${
                      selectedId === item.id ? "bg-teal-50/70" : ""
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-slate-900">
                          {item.applicantName}
                        </span>
                        <span className="mt-1 block font-mono text-[10px] text-slate-500">
                          {item.id}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-medium ${
                          item.eligible
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {item.eligible ? copy.eligible : copy.blocked}
                      </span>
                    </span>
                    <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                      <span>{item.village}</span>
                      <span>{dateLabel(item.submissionDate)}</span>
                    </span>
                    <span className="mt-2 block text-[10px] text-slate-600">
                      {copy.documentStatus}:{" "}
                      {t.documentVerification.applicationStatus[item.status]} ·{" "}
                      {copy.stage}: {fieldCopy.workflow[item.workflowStage]}
                    </span>
                    <span className="mt-2 block text-[10px] text-slate-600">
                      {copy.assigned}:{" "}
                      {item.assignedOfficer?.name ?? copy.noValue}
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-600">
                      {copy.visitOfficer}:{" "}
                      {item.fieldOfficer?.name ?? copy.noValue}
                      {" · "}
                      {fieldCopy.status[item.fieldVerificationStatus]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <div className="space-y-4">
          {detailLoading && !current && (
            <p
              role="status"
              className="rounded-xl border bg-white p-5 text-xs text-slate-500"
            >
              {copy.loadingDetails}
            </p>
          )}
          {detailError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
            >
              {detailError}
              <button
                type="button"
                onClick={() => void loadReview()}
                className="ml-2 font-semibold underline"
              >
                {copy.retry}
              </button>
            </div>
          )}
          {!current && !detailLoading && !detailError && (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-500">
              {copy.noSelection}
            </p>
          )}
          {current && application && (
            <>
              <header className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="font-mono text-[10px] font-semibold text-slate-500">
                    {application.id}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    {application.applicantName}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge
                      label={
                        application.decisionStatus
                          ? copy.statusLabel[application.decisionStatus]
                          : t.documentVerification.applicationStatus[
                              application.status
                            ]
                      }
                    />
                    <StatusBadge
                      label={fieldCopy.workflow[application.workflowStage]}
                      muted
                    />
                  </div>
                </div>
                <Link
                  href={`/applications/${encodeURIComponent(application.id)}`}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copy.workspace}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
              </header>

              <Card
                title={copy.applicantDetails}
                icon={<UserRound size={16} />}
              >
                <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Info
                    label={copy.applicant}
                    value={application.applicantName}
                  />
                  <Info
                    label={copy.village}
                    value={application.village || copy.noValue}
                  />
                  <Info
                    label={copy.address}
                    value={application.address || copy.noValue}
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
                    label={copy.income}
                    value={
                      application.annualFamilyIncome === null
                        ? copy.noValue
                        : new Intl.NumberFormat(
                            language === "kn" ? "kn-IN" : "en-IN",
                            {
                              style: "currency",
                              currency: "INR",
                              maximumFractionDigits: 0,
                            },
                          ).format(application.annualFamilyIncome)
                    }
                  />
                  <Info
                    label={copy.purpose}
                    value={application.applicationPurpose || copy.noValue}
                  />
                  <Info
                    label={copy.service}
                    value={
                      application.serviceType === "INCOME_CERTIFICATE"
                        ? t.dashboard.service
                        : application.serviceType.replaceAll("_", " ")
                    }
                  />
                  <Info
                    label={copy.submitted}
                    value={dateLabel(application.submissionDate)}
                  />
                  <Info
                    label={copy.assigned}
                    value={application.assignedOfficer?.name ?? copy.noValue}
                  />
                  <Info
                    label={copy.fieldStatus}
                    value={fieldCopy.status[report?.status ?? "NOT_SCHEDULED"]}
                  />
                </dl>
              </Card>

              <ApplicationAiAnalysis applicationId={application.id} />

              <Card title={copy.fieldReport} icon={<MapPinned size={16} />}>
                {!report ? (
                  <p className="text-xs text-slate-500">{copy.noReport}</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge
                        label={
                          report.status === "DRAFT"
                            ? copy.draft
                            : report.status === "SUBMITTED"
                              ? copy.submittedReport
                              : fieldCopy.status[report.status]
                        }
                      />
                      {report.followUpRequested && (
                        <StatusBadge label={copy.followUp} muted />
                      )}
                    </div>
                    <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Info
                        label={copy.visitOfficer}
                        value={report.assignedOfficer?.name ?? copy.noValue}
                      />
                      <Info
                        label={copy.visitDate}
                        value={dateLabel(report.scheduledAt)}
                      />
                      <Info
                        label={copy.submittedBy}
                        value={report.submittedBy?.name ?? copy.noValue}
                      />
                      <Info
                        label={copy.reportDate}
                        value={dateLabel(report.submittedAt)}
                      />
                      <Info
                        label={copy.outcome}
                        value={
                          report.outcome
                            ? fieldCopy.outcomeLabels[report.outcome]
                            : copy.noValue
                        }
                      />
                      <Info
                        label={copy.visitStatus}
                        value={fieldCopy.status[report.status]}
                      />
                    </dl>
                    {report.checklist?.length ? (
                      <div>
                        <h3 className="mb-2 text-[10px] font-semibold text-slate-700">
                          {copy.checklist}
                        </h3>
                        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                          {report.checklist.map((answer) => (
                            <li
                              key={answer.key}
                              className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-start sm:justify-between"
                            >
                              <span className="text-xs text-slate-800">
                                {getFieldChecklistLabel(language, answer.key)}
                              </span>
                              <span className="text-[10px] text-slate-600">
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
                      <p className="text-xs text-slate-500">
                        {copy.noChecklist}
                      </p>
                    )}
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <Info
                        label={copy.observations}
                        value={report.observations || copy.noValue}
                      />
                      <Info
                        label={copy.reportRemarks}
                        value={report.reportRemarks || copy.noValue}
                      />
                    </dl>
                  </div>
                )}
              </Card>

              {current.detail.eligibility.missingRequiredDocuments.length >
                0 && (
                <Card
                  title={copy.missingDocuments}
                  icon={<ClipboardCheck size={16} />}
                >
                  <ul className="list-inside list-disc space-y-1 text-xs text-amber-900">
                    {current.detail.eligibility.missingRequiredDocuments.map(
                      (item) => (
                        <li key={`${item.category}:${item.label}`}>
                          {t.documentVerification.category[item.category]}
                          {item.label ? ` · ${item.label}` : ""}
                        </li>
                      ),
                    )}
                  </ul>
                </Card>
              )}

              <ApplicationDocumentPanel
                applicationId={application.id}
                onApplicationStatus={noOpStatusUpdate}
                readOnly
              />

              <Card
                title={copy.followUpRequirements}
                icon={<FileText size={16} />}
              >
                {current.detail.missingRequests.length ||
                report?.followUpRequested ||
                report?.reportRemarks ? (
                  <ul className="space-y-2 text-xs text-slate-700">
                    {report?.followUpRequested && (
                      <li>{report.reportRemarks || copy.followUp}</li>
                    )}
                    {current.detail.missingRequests.map((item) => (
                      <li key={item.id}>
                        {item.reason}
                        <span className="ml-2 text-[10px] text-slate-500">
                          · {item.requestedBy.name} ·{" "}
                          {dateLabel(item.requestedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">{copy.noValue}</p>
                )}
              </Card>

              <Card title={copy.history} icon={<FileClock size={16} />}>
                {activity.length === 0 ? (
                  <p className="text-xs text-slate-500">{copy.noHistory}</p>
                ) : (
                  <ol className="divide-y divide-slate-100">
                    {activity.map((event) => (
                      <li
                        key={event.id}
                        className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4"
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-800">
                            {event.title}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {event.actor}
                            {event.detail ? ` · ${event.detail}` : ""}
                          </p>
                        </div>
                        <time
                          dateTime={event.timestamp}
                          className="text-[10px] text-slate-500"
                        >
                          {dateLabel(event.timestamp)}
                        </time>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>

              <Card title={copy.decisionPanel} icon={<ShieldCheck size={16} />}>
                <p className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] leading-5 text-blue-900">
                  {copy.reviewNotice}
                </p>
                {savedNotice && (
                  <p
                    role="status"
                    className="mb-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800"
                  >
                    {savedNotice}
                  </p>
                )}
                {!current.detail.eligibility.allowed && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <h3 className="text-xs font-semibold text-amber-900">
                      {copy.blockers}
                    </h3>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-[10px] text-amber-900">
                      {current.detail.eligibility.blockers.map((blocker) => (
                        <li key={blocker}>
                          {copy.blockerLabels[
                            blocker as keyof typeof copy.blockerLabels
                          ] ?? blocker.replaceAll("_", " ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {demoMode && (
                  <label className="mb-4 block max-w-md">
                    <span className="mb-1 block text-[10px] font-medium text-slate-700">
                      {copy.demoReviewer}
                    </span>
                    <select
                      value={demoReviewerId}
                      onChange={(event) =>
                        setDemoReviewerId(event.target.value)
                      }
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs"
                      disabled={submitting}
                    >
                      <option value="">{copy.selectReviewer}</option>
                      {queue?.reviewers.map((reviewer) => (
                        <option key={reviewer.id} value={reviewer.id}>
                          {reviewer.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <fieldset disabled={!canDecide || submitting}>
                  <legend className="mb-2 text-[10px] font-medium text-slate-700">
                    {copy.chooseDecision}
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {decisions.map((decision) => (
                      <button
                        key={decision}
                        type="button"
                        aria-pressed={selectedDecision === decision}
                        onClick={() => chooseDecision(decision)}
                        className={`min-h-10 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                          selectedDecision === decision
                            ? "border-teal-700 bg-teal-50 text-teal-900 ring-2 ring-teal-100"
                            : decision === "REJECT"
                              ? "border-rose-200 text-rose-800 hover:bg-rose-50"
                              : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {copy.decisionLabel[decision]}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {selectedDecision && (
                  <label className="mt-4 block">
                    <span className="mb-1 block text-[10px] font-medium text-slate-700">
                      {copy.remarks}
                    </span>
                    <textarea
                      value={remarks}
                      onChange={(event) => setRemarks(event.target.value)}
                      required={selectedDecision !== "APPROVE"}
                      maxLength={3000}
                      rows={3}
                      placeholder={copy.remarksPlaceholder}
                      className="w-full rounded-lg border border-slate-200 p-3 text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    />
                    <span className="mt-1 block text-[10px] text-slate-500">
                      {selectedDecision === "APPROVE"
                        ? copy.approveRemarks
                        : copy.remarksRequired}
                    </span>
                  </label>
                )}
                {decisionError && (
                  <p role="alert" className="mt-3 text-xs text-rose-700">
                    {decisionError}
                  </p>
                )}
                {application.workflowStage === "FINAL_REVIEW" &&
                  application.decisionStatus && (
                    <p className="mt-3 text-[10px] text-slate-600">
                      {copy.decisionRecorded}:{" "}
                      {copy.statusLabel[application.decisionStatus]}
                    </p>
                  )}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDecisionError("");
                      setConfirming(true);
                    }}
                    disabled={!canDecide || !selectedDecision || submitting}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#12243d] px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CheckCircle2 size={15} aria-hidden="true" />
                    {copy.submit}
                  </button>
                  {application.workflowStage !== "FINAL_REVIEW" && (
                    <span className="text-[10px] text-slate-500">
                      {application.decisionStatus
                        ? copy.statusLabel[application.decisionStatus]
                        : fieldCopy.workflow[application.workflowStage]}
                    </span>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>

      {confirming && selectedDecision && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="final-review-confirm-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h2
              id="final-review-confirm-title"
              className="text-sm font-semibold text-slate-900"
            >
              {copy.confirmTitle}
            </h2>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {application?.id} · {application?.applicantName}
              <br />
              {copy.decisionLabel[selectedDecision]}
              {remarks.trim() ? ` · ${remarks.trim()}` : ""}
            </p>
            {decisionError && (
              <p role="alert" className="mt-3 text-xs text-rose-700">
                {decisionError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={() => void confirmDecision()}
                disabled={submitting}
                className="h-9 rounded-lg bg-[#12243d] px-3 text-xs font-semibold text-white disabled:opacity-50"
              >
                {submitting ? copy.submitting : copy.confirmSubmit}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  label,
  muted = false,
}: {
  label: string;
  muted?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${
        muted ? "bg-slate-100 text-slate-700" : "bg-teal-50 text-teal-800"
      }`}
    >
      {label}
    </span>
  );
}
