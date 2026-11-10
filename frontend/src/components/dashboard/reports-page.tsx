"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BarChart3,
  Download,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import {
  downloadReportCsv,
  getOperationsErrorMessage,
  getDashboardReport,
  type DashboardReport,
  type OperationsFilters,
} from "@/lib/operations-api";
import { getOperationsWords, operationLabel } from "@/lib/operations-i18n";

const emptyFilters: OperationsFilters = {
  fromDate: "",
  toDate: "",
  status: "all",
  workflowStage: "all",
  officerId: "all",
  serviceType: "all",
  search: "",
};

const applicationStatuses = [
  "DOCUMENT_REVIEW_PENDING",
  "DOCUMENTS_VERIFIED",
  "DOCUMENTS_AWAITING_REPLACEMENT",
  "DOCUMENTS_INCOMPLETE",
  "DOCUMENTS_REJECTED",
];
const workflowStages = [
  "DOCUMENT_VERIFICATION",
  "FIELD_VERIFICATION",
  "FINAL_REVIEW",
  "COMPLETED",
];

export function ReportsPage() {
  const { language, documentApiToken, t } = useDashboard();
  const words = getOperationsWords(language);
  const [filters, setFilters] = useState<OperationsFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<OperationsFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    getDashboardReport(documentApiToken, appliedFilters, page, 10)
      .then((result) => {
        if (active) {
          setReport(result);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(getOperationsErrorMessage(cause, words.loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appliedFilters, documentApiToken, page, reload, words.loadError]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      filters.fromDate &&
      filters.toDate &&
      filters.fromDate > filters.toDate
    ) {
      setError(words.invalidDateRange);
      return;
    }
    setLoading(true);
    setError("");
    setPage(1);
    setAppliedFilters({ ...filters });
  }

  function resetFilters() {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
    setLoading(true);
    setError("");
  }

  async function exportCsv() {
    setExporting(true);
    setError("");
    try {
      const file = await downloadReportCsv(documentApiToken, appliedFilters);
      downloadBlob(file, "janaseva-reports.csv");
    } catch (cause) {
      setError(getOperationsErrorMessage(cause, words.loadError));
    } finally {
      setExporting(false);
    }
  }

  const numberFormat = new Intl.NumberFormat(
    language === "kn" ? "kn-IN" : "en-IN",
  );
  const dateFormat = new Intl.DateTimeFormat(
    language === "kn" ? "kn-IN" : "en-IN",
    { dateStyle: "medium", timeZone: "Asia/Kolkata" },
  );

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={words.databaseRecords}
        title={words.reportsTitle}
        description={words.reportsSubtitle}
      />

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label={words.reportsTitle}
      >
        <MetricCard
          label={words.totalApplications}
          value={report?.summary.totalApplications}
          loading={loading}
          icon={<FileText size={17} aria-hidden="true" />}
          format={numberFormat}
        />
        <MetricCard
          label={words.documentPending}
          value={report?.summary.documentReviewPending}
          loading={loading}
          icon={<AlertCircle size={17} aria-hidden="true" />}
          format={numberFormat}
        />
        <MetricCard
          label={words.fieldVerification}
          value={report?.summary.fieldVerification}
          loading={loading}
          icon={<BarChart3 size={17} aria-hidden="true" />}
          format={numberFormat}
        />
        <MetricCard
          label={words.completedWorkflow}
          value={report?.summary.completedWorkflow}
          loading={loading}
          icon={<RefreshCw size={17} aria-hidden="true" />}
          format={numberFormat}
        />
      </section>

      <section
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
        aria-labelledby="decision-metrics-title"
      >
        <h3
          id="decision-metrics-title"
          className="text-xs font-semibold text-amber-950"
        >
          {words.decisionsTracked}
        </h3>
        <p className="mt-1 text-xs leading-5 text-amber-900">
          {words.unsupportedMetrics}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            {
              label: words.approvedApplications,
              count: report?.summary.approvedApplications ?? 0,
            },
            {
              label: words.rejectedApplications,
              count: report?.summary.rejectedApplications ?? 0,
            },
            {
              label: words.returnedApplications,
              count: report?.summary.returnedApplications ?? 0,
            },
          ].map(({ label, count }) => (
            <span
              key={label}
              className="rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-[11px] text-amber-900"
            >
              {label}: {numberFormat.format(count)}
            </span>
          ))}
          <span className="rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-[11px] text-amber-900">
            {words.overdueApplications}: {words.notTracked}
          </span>
        </div>
      </section>

      <form
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={applyFilters}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            {words.filters}
          </h3>
          <button
            type="button"
            onClick={() => void exportCsv()}
            disabled={exporting}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            <Download size={15} aria-hidden="true" />
            {exporting ? words.exporting : words.exportCsv}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-[11px] font-medium text-slate-600">
            <span>{words.fromDate}</span>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  fromDate: event.target.value,
                }))
              }
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-[11px] font-medium text-slate-600">
            <span>{words.toDate}</span>
            <input
              type="date"
              value={filters.toDate}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  toDate: event.target.value,
                }))
              }
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-[11px] font-medium text-slate-600">
            <span>{words.officer}</span>
            <select
              value={filters.officerId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  officerId: event.target.value,
                }))
              }
              className={inputClass}
            >
              <option value="all">{words.allOfficers}</option>
              {(report?.filters.officers ?? []).map((officer) => (
                <option key={officer.id} value={officer.id}>
                  {officer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-medium text-slate-600">
            <span>{words.service}</span>
            <select
              value={filters.serviceType}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  serviceType: event.target.value,
                }))
              }
              className={inputClass}
            >
              <option value="all">{words.allServices}</option>
              {(report?.filters.serviceTypes ?? []).map((service) => (
                <option key={service} value={service}>
                  {formatEnum(service)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-medium text-slate-600">
            <span>{words.status}</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
              className={inputClass}
            >
              <option value="all">{words.allStatuses}</option>
              {applicationStatuses.map((status) => (
                <option key={status} value={status}>
                  {operationLabel(language, "status", status)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-medium text-slate-600">
            <span>{words.stage}</span>
            <select
              value={filters.workflowStage}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  workflowStage: event.target.value,
                }))
              }
              className={inputClass}
            >
              <option value="all">{words.allStages}</option>
              {workflowStages.map((stage) => (
                <option key={stage} value={stage}>
                  {operationLabel(language, "stage", stage)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-medium text-slate-600 sm:col-span-2">
            <span>{words.search}</span>
            <input
              type="search"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              className={inputClass}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="submit"
            className="h-9 rounded-lg bg-[#12243d] px-4 text-xs font-medium text-white transition hover:bg-[#1b3555]"
          >
            {words.applyFilters}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {words.resetFilters}
          </button>
        </div>
      </form>

      {error && (
        <ErrorBanner
          message={error}
          retry={() => {
            setLoading(true);
            setError("");
            setReload((current) => current + 1);
          }}
          label={words.retry}
        />
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={words.submissionsTrend} note={words.last30Days}>
          {loading && !report ? (
            <LoadingState text={words.loading} />
          ) : report?.submissionsByDay.length ? (
            <TrendChart
              rows={report.submissionsByDay}
              formatNumber={numberFormat}
              language={language}
            />
          ) : (
            <EmptyState text={words.noRecords} />
          )}
        </Panel>
        <Panel title={words.workflowDistribution}>
          {loading && !report ? (
            <LoadingState text={words.loading} />
          ) : report?.workflowStageBreakdown.length ? (
            <div className="space-y-4">
              {report.workflowStageBreakdown.map((item) => {
                const percent = report.summary.totalApplications
                  ? (item.count / report.summary.totalApplications) * 100
                  : 0;
                return (
                  <div key={item.workflowStage}>
                    <div className="mb-1.5 flex justify-between gap-3 text-xs">
                      <span className="text-slate-700">
                        {operationLabel(language, "stage", item.workflowStage)}
                      </span>
                      <span className="font-semibold tabular-nums text-slate-900">
                        {numberFormat.format(item.count)}
                      </span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-slate-100"
                      role="img"
                      aria-label={`${operationLabel(language, "stage", item.workflowStage)}: ${numberFormat.format(item.count)}`}
                    >
                      <div
                        className="h-full rounded-full bg-teal-600"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState text={words.noRecords} />
          )}
        </Panel>
        <Panel title={words.statusBreakdown}>
          {loading && !report ? (
            <LoadingState text={words.loading} />
          ) : report?.documentStatusBreakdown.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {report.documentStatusBreakdown.map((item) => (
                <div
                  key={item.status}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5"
                >
                  <span className="text-xs text-slate-600">
                    {operationLabel(language, "status", item.status)}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {numberFormat.format(item.count)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text={words.noRecords} />
          )}
        </Panel>
        <Panel title={words.officerWorkload}>
          {loading && !report ? (
            <LoadingState text={words.loading} />
          ) : report?.officerWorkload.length ? (
            <div className="space-y-2">
              {report.officerWorkload.map((item) => (
                <div
                  key={item.officer?.id ?? item.count}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5"
                >
                  <span className="text-xs text-slate-700">
                    {item.officer?.name ?? words.noOfficerRecorded}
                  </span>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold tabular-nums text-slate-800">
                    {numberFormat.format(item.count)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text={words.noRecords} />
          )}
        </Panel>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            {words.reportsTitle}
          </h3>
          {report && (
            <span className="text-[11px] text-slate-500">
              {numberFormat.format(report.total)} {t.table.applications}
            </span>
          )}
        </div>
        {loading && !report ? (
          <LoadingState text={words.loading} />
        ) : report?.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    {[
                      words.applicationId,
                      words.applicant,
                      words.village,
                      words.submitted,
                      words.status,
                      words.stage,
                      words.priority,
                      words.officer,
                    ].map((label) => (
                      <th key={label} className="px-4 py-3 font-semibold">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.items.map((item) => (
                    <tr key={item.id} className="text-xs text-slate-700">
                      <td className="whitespace-nowrap px-4 py-3 font-medium">
                        <Link
                          className="text-blue-700 hover:underline"
                          href={`/applications/${encodeURIComponent(item.id)}`}
                        >
                          {item.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{item.applicantName}</td>
                      <td className="px-4 py-3">{item.village}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {dateFormat.format(new Date(item.submissionDate))}
                      </td>
                      <td className="px-4 py-3">
                        {operationLabel(language, "status", item.status)}
                      </td>
                      <td className="px-4 py-3">
                        {operationLabel(language, "stage", item.workflowStage)}
                      </td>
                      <td className="px-4 py-3">
                        {operationLabel(language, "priority", item.priority)}
                      </td>
                      <td className="px-4 py-3">
                        {item.assignedOfficer?.name ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={report.page}
              totalPages={report.totalPages}
              onPage={(nextPage) => {
                setLoading(true);
                setPage(nextPage);
              }}
              words={words}
              formatNumber={numberFormat}
            />
          </>
        ) : (
          <EmptyState text={words.noRecords} />
        )}
      </section>
    </div>
  );
}

const inputClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-teal-800">
        {eyebrow}
      </p>
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  loading,
  icon,
  format,
}: {
  label: string;
  value?: number;
  loading: boolean;
  icon: ReactNode;
  format: Intl.NumberFormat;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-[11px] font-medium">{label}</span>
        <span className="text-teal-700">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900">
        {value === undefined && loading ? "…" : format.format(value ?? 0)}
      </p>
    </div>
  );
}

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {note && <p className="mt-1 text-[10px] text-slate-500">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function TrendChart({
  rows,
  formatNumber,
  language,
}: {
  rows: { date: string; count: number }[];
  formatNumber: Intl.NumberFormat;
  language: "kn" | "en";
}) {
  const maximum = Math.max(1, ...rows.map((row) => row.count));
  const locale = language === "kn" ? "kn-IN" : "en-IN";
  return (
    <div className="flex h-44 items-end gap-1 overflow-x-auto border-b border-l border-slate-200 px-2 pb-1">
      {rows.map((row) => {
        const height = Math.max(3, (row.count / maximum) * 100);
        const date = new Date(`${row.date}T12:00:00+05:30`);
        const label = new Intl.DateTimeFormat(locale, {
          month: "short",
          day: "numeric",
          timeZone: "Asia/Kolkata",
        }).format(date);
        return (
          <div
            key={row.date}
            className="group flex h-full min-w-5 flex-1 flex-col items-center justify-end"
            title={`${row.date}: ${formatNumber.format(row.count)}`}
          >
            <span className="mb-1 hidden text-[9px] text-slate-500 group-hover:block">
              {formatNumber.format(row.count)}
            </span>
            <div
              className="w-full max-w-7 rounded-t bg-teal-600 transition-colors group-hover:bg-blue-700"
              style={{ height: `${height}%` }}
            />
            <span className="mt-2 text-[8px] text-slate-500">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
  words,
  formatNumber,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  words: ReturnType<typeof getOperationsWords>;
  formatNumber: Intl.NumberFormat;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50"
      >
        {words.previous}
      </button>
      <span className="text-[11px] text-slate-500">
        {words.page} {formatNumber.format(page)} {words.of}{" "}
        {formatNumber.format(totalPages)}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50"
      >
        {words.next}
      </button>
    </div>
  );
}

function ErrorBanner({
  message,
  retry,
  label,
}: {
  message: string;
  retry: () => void;
  label: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={retry}
        className="shrink-0 rounded border border-rose-200 bg-white px-2 py-1 font-medium"
      >
        {label}
      </button>
    </div>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex min-h-24 items-center justify-center gap-2 text-xs text-slate-500">
      <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
      {text}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="py-8 text-center text-xs text-slate-500" role="status">
      {text}
    </p>
  );
}

function formatEnum(value: string) {
  return value.replaceAll("_", " ");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
