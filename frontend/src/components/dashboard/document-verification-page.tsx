"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileClock,
  FileText,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { getAiAnalysisCopy } from "@/lib/ai-analysis-i18n";
import {
  DocumentApiError,
  getVerificationOfficers,
  getVerificationQueue,
  isDocumentDemoAuthEnabled,
  type ApplicationDocumentStatus,
  type ApplicationWorkflowStage,
  type DocumentStatus,
  type VerificationOfficer,
  type VerificationQueue,
} from "@/lib/document-verification-api";

type SortField =
  "applicationId" | "applicantName" | "village" | "submissionDate" | "status";

const documentStatuses: DocumentStatus[] = [
  "MISSING",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "REJECTED",
  "REPLACEMENT_REQUESTED",
];
const workflowStages: ApplicationWorkflowStage[] = [
  "DOCUMENT_VERIFICATION",
  "FIELD_VERIFICATION",
  "FINAL_REVIEW",
  "COMPLETED",
];
const applicationStatuses: ApplicationDocumentStatus[] = [
  "DOCUMENT_REVIEW_PENDING",
  "DOCUMENTS_VERIFIED",
  "DOCUMENTS_AWAITING_REPLACEMENT",
  "DOCUMENTS_INCOMPLETE",
  "DOCUMENTS_REJECTED",
];

export function DocumentVerificationPage() {
  const { documentApiToken, language, setDocumentApiToken, t } = useDashboard();
  const hasDocumentApiAccess =
    Boolean(documentApiToken) || isDocumentDemoAuthEnabled();
  const copy = t.documentVerification;
  const aiCopy = getAiAnalysisCopy(language);
  const [tokenInput, setTokenInput] = useState("");
  const [queue, setQueue] = useState<VerificationQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [officers, setOfficers] = useState<VerificationOfficer[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [stage, setStage] = useState("all");
  const [officer, setOfficer] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [sort, setSort] = useState<SortField>("submissionDate");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const queryString = useMemo(() => {
    const parameters = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sort,
      order,
    });
    if (query.trim()) parameters.set("search", query.trim());
    if (status.startsWith("application:")) {
      parameters.set("status", status.slice("application:".length));
    } else if (status !== "all") {
      parameters.set("documentStatus", status);
    }
    if (stage !== "all") parameters.set("stage", stage);
    if (officer !== "all") parameters.set("officer", officer);
    if (from) parameters.set("from", from);
    if (to) parameters.set("to", `${to}T23:59:59.999Z`);
    return parameters;
  }, [from, officer, order, page, pageSize, query, sort, stage, status, to]);

  useEffect(() => {
    if (!hasDocumentApiAccess) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      setError("");
      try {
        const data = await getVerificationQueue(documentApiToken, queryString);
        if (active) {
          setQueue(data);
          setError("");
          setLoading(false);
        }
      } catch (cause: unknown) {
        if (!active) return;
        setQueue(null);
        setError(
          cause instanceof DocumentApiError && cause.status === 401
            ? copy.invalidToken
            : cause instanceof DocumentApiError && cause.status === 503
              ? copy.setupRequired
              : cause instanceof DocumentApiError && cause.status === 403
                ? copy.roleDenied
                : cause instanceof DocumentApiError && cause.status === 408
                  ? copy.requestTimedOut
                  : cause instanceof DocumentApiError && cause.status === 502
                    ? copy.invalidResponse
                    : cause instanceof DocumentApiError
                      ? cause.message
                      : copy.apiError,
        );
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [copy, documentApiToken, hasDocumentApiAccess, queryString]);

  useEffect(() => {
    if (!hasDocumentApiAccess) return;
    let active = true;
    void getVerificationOfficers(documentApiToken)
      .then((items) => {
        if (active) setOfficers(items);
      })
      .catch(() => {
        if (active) setOfficers([]);
      });
    return () => {
      active = false;
    };
  }, [documentApiToken, hasDocumentApiAccess]);

  const dateLabel = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(language === "kn" ? "kn-IN" : "en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(new Date(value))
      : "—";

  function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = tokenInput.trim().replace(/^Bearer\s+/i, "");
    if (!token) return;
    setQueue(null);
    setError("");
    setDocumentApiToken(token);
    setTokenInput("");
  }

  function toggleSort(field: SortField) {
    if (field === sort) {
      setOrder((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setOrder(field === "submissionDate" ? "desc" : "asc");
    }
    setPage(1);
  }

  const sortButton = (field: SortField, label: string) => (
    <th
      aria-sort={
        sort === field ? (order === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className="inline-flex items-center gap-1.5 whitespace-nowrap text-left font-semibold hover:text-slate-900"
      >
        {label}
        <span className={sort === field ? "text-teal-700" : "text-slate-300"}>
          {sort !== field ? (
            <ArrowDownUp size={12} />
          ) : order === "asc" ? (
            <ArrowUp size={12} />
          ) : (
            <ArrowDown size={12} />
          )}
        </span>
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-teal-800">
            {t.dashboard.eyebrow}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {copy.title}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{copy.subtitle}</p>
        </div>
        {documentApiToken && !isDocumentDemoAuthEnabled() && (
          <button
            type="button"
            onClick={() => {
              setDocumentApiToken("");
              setQueue(null);
              setOfficers([]);
              setError("");
            }}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
          >
            <X size={13} />
            {copy.disconnect}
          </button>
        )}
      </section>

      {!hasDocumentApiAccess ? (
        <section className="rounded-xl border border-amber-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
              <ShieldAlert size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">
                {copy.authTitle}
              </h3>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
                {copy.authDescription}
              </p>
              <form
                onSubmit={connect}
                className="mt-4 flex flex-col gap-2 sm:flex-row"
              >
                <label className="min-w-0 flex-1">
                  <span className="sr-only">{copy.authTokenLabel}</span>
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={tokenInput}
                    onChange={(event) => setTokenInput(event.target.value)}
                    placeholder={copy.authTokenPlaceholder}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
                  />
                </label>
                <button
                  type="submit"
                  className="h-10 shrink-0 rounded-lg bg-[#12243d] px-4 text-xs font-medium text-white hover:bg-[#1b3555]"
                >
                  {copy.connect}
                </button>
              </form>
              <p className="mt-2 text-[10px] text-slate-400">
                {copy.tokenSessionNote}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          {queue && <SummaryCards queue={queue} />}

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <label className="relative sm:col-span-2 xl:col-span-2">
                <span className="sr-only">{copy.search}</span>
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder={copy.search}
                  className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-8 text-[11px] outline-none focus:border-teal-600"
                />
                {query && (
                  <button
                    type="button"
                    aria-label={t.topbar.clearSearch}
                    onClick={() => setQuery("")}
                    className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:text-slate-700"
                  >
                    <X size={13} />
                  </button>
                )}
              </label>
              <label>
                <span className="sr-only">{copy.statusFilter}</span>
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] text-slate-600"
                >
                  <option value="all">{copy.allStatuses}</option>
                  {documentStatuses.map((value) => (
                    <option key={value} value={value}>
                      {copy.documentStatus[value]}
                    </option>
                  ))}
                  {applicationStatuses.map((value) => (
                    <option key={value} value={`application:${value}`}>
                      {copy.applicationStatus[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">{copy.stageFilter}</span>
                <select
                  value={stage}
                  onChange={(event) => {
                    setStage(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] text-slate-600"
                >
                  <option value="all">{copy.allStages}</option>
                  {workflowStages.map((value) => (
                    <option key={value} value={value}>
                      {copy.stage[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">{copy.officerFilter}</span>
                <select
                  value={officer}
                  onChange={(event) => {
                    setOfficer(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] text-slate-600"
                >
                  <option value="all">{copy.allOfficers}</option>
                  {officers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">{copy.fromDate}</span>
                <input
                  aria-label={copy.fromDate}
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 px-2 text-[10px] text-slate-600"
                />
              </label>
              <label>
                <span className="sr-only">{copy.toDate}</span>
                <input
                  aria-label={copy.toDate}
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 px-2 text-[10px] text-slate-600"
                />
              </label>
            </div>
          </section>

          {error && queue && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
            >
              {error}
            </p>
          )}

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            {!queue && loading ? (
              <div className="flex min-h-40 items-center justify-center gap-2 text-xs text-slate-500">
                <RefreshCw size={15} className="animate-spin" />
                {copy.loading}
              </div>
            ) : !queue ? (
              <div
                role={error ? "alert" : undefined}
                className="flex min-h-40 items-center justify-center px-5 text-center text-xs text-rose-800"
              >
                {error || copy.apiError}
              </div>
            ) : queue.items.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <Search
                  size={22}
                  className="mx-auto mb-2 text-slate-300"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-slate-700">
                  {copy.noResults}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1160px] border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50/80 text-[10px] uppercase tracking-[0.07em] text-slate-500">
                      {sortButton("applicationId", copy.applicationId)}
                      {sortButton("applicantName", copy.applicant)}
                      {sortButton("village", copy.village)}
                      <th>{copy.documents}</th>
                      <th>{copy.verifiedCount}</th>
                      <th>{copy.pendingCount}</th>
                      <th>{copy.missingCount}</th>
                      {sortButton("status", copy.overallStatus)}
                      <th>{copy.assignedOfficer}</th>
                      {sortButton("submissionDate", copy.lastUpdated)}
                      <th>{copy.action}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {queue.items.map((item) => (
                      <tr
                        key={item.applicationId}
                        className="transition-colors hover:bg-slate-50/70"
                      >
                        <td className="whitespace-nowrap px-4 py-3.5 text-[11px] font-semibold text-slate-700">
                          {item.applicationId}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs font-medium text-slate-900">
                          {item.applicantName}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-600">
                          {item.village}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600">
                          {item.documentCount}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-emerald-700">
                          {item.verifiedCount}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-amber-700">
                          {item.pendingCount}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-rose-700">
                          {item.missingCount}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <ApplicationStatusBadge status={item.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-[11px] text-slate-600">
                          {item.assignedOfficer?.name ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-[11px] text-slate-500">
                          {dateLabel(item.lastUpdated)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <Link
                            href={`/applications/${encodeURIComponent(item.applicationId)}`}
                            className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-2.5 text-[10px] font-medium text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
                          >
                            {copy.view}
                          </Link>
                          <Link
                            href={`/applications/${encodeURIComponent(item.applicationId)}#ai-analysis`}
                            className="ml-1 inline-flex h-8 items-center gap-1 rounded-lg bg-blue-50 px-2.5 text-[10px] font-medium text-blue-800 hover:bg-blue-100"
                          >
                            <BrainCircuit size={13} aria-hidden="true" />
                            {aiCopy.analyze}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {queue && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500 sm:px-5">
                <span>
                  {queue.total} · {copy.pageOf} {queue.page} {copy.of}{" "}
                  {queue.totalPages || 1}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => value - 1)}
                    className="h-8 rounded-md border border-slate-200 px-3 disabled:opacity-40"
                  >
                    {copy.previous}
                  </button>
                  <button
                    type="button"
                    disabled={page >= queue.totalPages}
                    onClick={() => setPage((value) => value + 1)}
                    className="h-8 rounded-md border border-slate-200 px-3 disabled:opacity-40"
                  >
                    {copy.next}
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCards({ queue }: { queue: VerificationQueue }) {
  const { t } = useDashboard();
  const copy = t.documentVerification;
  const cards = [
    {
      label: copy.summary.received,
      value: queue.summary.documentsReceived,
      icon: FileText,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: copy.summary.pending,
      value: queue.summary.pending,
      icon: Clock3,
      tone: "bg-amber-50 text-amber-800",
    },
    {
      label: copy.summary.verified,
      value: queue.summary.verified,
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: copy.summary.replacement,
      value: queue.summary.replacementRequested,
      icon: RefreshCw,
      tone: "bg-rose-50 text-rose-700",
    },
    {
      label: copy.summary.missing,
      value: queue.summary.missing,
      icon: FileClock,
      tone: "bg-slate-100 text-slate-700",
    },
  ];
  return (
    <section className="grid grid-cols-1 gap-3 min-[450px]:grid-cols-2 xl:grid-cols-5">
      {cards.map(({ label, value, icon: Icon, tone }) => (
        <article
          key={label}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {value}
              </p>
            </div>
            <span
              className={`flex size-9 items-center justify-center rounded-lg ${tone}`}
            >
              <Icon size={17} />
            </span>
          </div>
        </article>
      ))}
    </section>
  );
}

function ApplicationStatusBadge({
  status,
}: {
  status: ApplicationDocumentStatus;
}) {
  const { t } = useDashboard();
  const tone: Record<ApplicationDocumentStatus, string> = {
    DOCUMENT_REVIEW_PENDING: "border-amber-100 bg-amber-50 text-amber-800",
    DOCUMENTS_VERIFIED: "border-emerald-100 bg-emerald-50 text-emerald-700",
    DOCUMENTS_AWAITING_REPLACEMENT:
      "border-violet-100 bg-violet-50 text-violet-700",
    DOCUMENTS_INCOMPLETE: "border-slate-200 bg-slate-100 text-slate-700",
    DOCUMENTS_REJECTED: "border-rose-100 bg-rose-50 text-rose-700",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-medium ${tone[status]}`}
    >
      {t.documentVerification.applicationStatus[status]}
    </span>
  );
}
