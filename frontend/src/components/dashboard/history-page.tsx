"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Download, ExternalLink, RefreshCw } from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { getVerificationOfficers } from "@/lib/document-verification-api";
import {
  downloadHistoryCsv,
  getOperationsErrorMessage,
  getDashboardHistory,
  type HistoryRecord,
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
  category: "all",
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

export function HistoryPage() {
  const { language, documentApiToken } = useDashboard();
  const words = getOperationsWords(language);
  const [filters, setFilters] = useState<OperationsFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<OperationsFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<{
    items: HistoryRecord[];
    summary: {
      total: number;
      applicationSubmissions: number;
      documentUploads: number;
      documentVerifications: number;
      fieldVisitsScheduled: number;
      fieldReportsSubmitted: number;
    };
    total: number;
    totalPages: number;
  } | null>(null);
  const [officers, setOfficers] = useState<
    { id: string; name: string; role: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [officerError, setOfficerError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<HistoryRecord | null>(null);

  useEffect(() => {
    let active = true;
    getDashboardHistory(documentApiToken, appliedFilters, page, 20)
      .then((result) => {
        if (active) {
          setHistory(result);
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

  useEffect(() => {
    let active = true;
    getVerificationOfficers(documentApiToken)
      .then((result) => {
        if (active) {
          setOfficers(result);
          setOfficerError("");
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setOfficerError(getOperationsErrorMessage(cause, words.loadError));
      });
    return () => {
      active = false;
    };
  }, [documentApiToken, words.loadError]);

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
    setSelected(null);
    setAppliedFilters({ ...filters });
  }

  function resetFilters() {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
    setLoading(true);
    setError("");
    setSelected(null);
  }

  async function exportCsv() {
    setExporting(true);
    setError("");
    try {
      const file = await downloadHistoryCsv(documentApiToken, appliedFilters);
      downloadBlob(file, "janaseva-history.csv");
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
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    },
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-teal-800">
          {words.databaseRecords}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          {words.historyTitle}
        </h2>
        <p className="mt-1 text-xs text-slate-500">{words.historySubtitle}</p>
        <p className="mt-1 text-[10px] leading-5 text-slate-500">
          {words.submissionHistoryNote}
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          label={words.activityTotal}
          value={history?.summary.total ?? 0}
          format={numberFormat}
        />
        <SummaryCard
          label={words.submissionEvents}
          value={history?.summary.applicationSubmissions ?? 0}
          format={numberFormat}
        />
        <SummaryCard
          label={words.documentUploads}
          value={history?.summary.documentUploads ?? 0}
          format={numberFormat}
        />
        <SummaryCard
          label={words.documentVerifications}
          value={history?.summary.documentVerifications ?? 0}
          format={numberFormat}
        />
        <SummaryCard
          label={words.scheduledVisits}
          value={history?.summary.fieldVisitsScheduled ?? 0}
          format={numberFormat}
        />
        <SummaryCard
          label={words.submittedReports}
          value={history?.summary.fieldReportsSubmitted ?? 0}
          format={numberFormat}
        />
      </section>

      <form
        onSubmit={applyFilters}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
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
            <span>{words.category}</span>
            <select
              value={filters.category}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
              className={inputClass}
            >
              <option value="all">{words.allCategories}</option>
              <option value="APPLICATION">{words.applicationCategory}</option>
              <option value="DOCUMENT">{words.documentCategory}</option>
              <option value="FIELD">{words.fieldCategory}</option>
            </select>
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
              {officers.map((officer) => (
                <option key={officer.id} value={officer.id}>
                  {officer.name}
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

      {(error || officerError) && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
        >
          {error || officerError}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError("");
              setReload((value) => value + 1);
            }}
            className="rounded border border-rose-200 bg-white px-2 py-1 font-medium"
          >
            {words.retry}
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            {words.historyTitle}
          </h3>
          <span className="text-[11px] text-slate-500">
            {numberFormat.format(history?.total ?? 0)} {words.actions}
          </span>
        </div>
        {loading && !history ? (
          <div className="flex min-h-32 items-center justify-center gap-2 text-xs text-slate-500">
            <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
            {words.loading}
          </div>
        ) : history?.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[850px] w-full border-collapse text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    {[
                      words.occurredAt,
                      words.applicationId,
                      words.applicant,
                      words.category,
                      words.activity,
                      words.officer,
                      words.details,
                    ].map((label) => (
                      <th key={label} className="px-4 py-3 font-semibold">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.items.map((item) => (
                    <tr
                      key={`${item.category}:${item.id}`}
                      className="text-xs text-slate-700"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        {dateFormat.format(new Date(item.occurredAt))}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium">
                        <Link
                          className="text-blue-700 hover:underline"
                          href={`/applications/${encodeURIComponent(item.applicationId)}`}
                        >
                          {item.applicationId}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block">{item.applicantName}</span>
                        <span className="text-[10px] text-slate-500">
                          {item.village}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {categoryLabel(item.category, words)}
                      </td>
                      <td className="px-4 py-3">
                        {operationLabel(language, "action", item.action)}
                      </td>
                      <td className="px-4 py-3">
                        {item.officerName ?? words.noOfficerRecorded}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          aria-label={`${words.details}: ${item.applicationId} ${operationLabel(language, "action", item.action)}`}
                          onClick={() => setSelected(item)}
                          className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {words.details}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={history.totalPages}
              onPage={(nextPage) => {
                setLoading(true);
                setPage(nextPage);
              }}
              words={words}
              formatNumber={numberFormat}
            />
          </>
        ) : (
          <p className="py-9 text-center text-xs text-slate-500" role="status">
            {words.noRecords}
          </p>
        )}
      </section>

      {selected && (
        <ActivityDetails
          item={selected}
          words={words}
          language={language}
          dateFormat={dateFormat}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

const inputClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

function SummaryCard({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format: Intl.NumberFormat;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900">
        {format.format(value)}
      </p>
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

function ActivityDetails({
  item,
  words,
  language,
  dateFormat,
  onClose,
}: {
  item: HistoryRecord;
  words: ReturnType<typeof getOperationsWords>;
  language: "kn" | "en";
  dateFormat: Intl.DateTimeFormat;
  onClose: () => void;
}) {
  const details = item.details ?? {};
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-details-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
              {categoryLabel(item.category, words)}
            </p>
            <h3
              id="activity-details-title"
              className="mt-1 text-base font-semibold text-slate-900"
            >
              {operationLabel(language, "action", item.action)}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700"
          >
            {words.closeDetails}
          </button>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <DetailItem label={words.applicationId} value={item.applicationId} />
          <DetailItem label={words.applicant} value={item.applicantName} />
          <DetailItem
            label={words.occurredAt}
            value={dateFormat.format(new Date(item.occurredAt))}
          />
          <DetailItem
            label={words.officer}
            value={item.officerName ?? words.noOfficerRecorded}
          />
          {item.documentLabel && (
            <DetailItem
              label={words.documentCategory}
              value={item.documentLabel}
            />
          )}
          {item.previousStatus && (
            <DetailItem
              label={words.previousStatus}
              value={item.previousStatus}
            />
          )}
          {item.newStatus && (
            <DetailItem label={words.newStatus} value={item.newStatus} />
          )}
          {item.remarks && (
            <DetailItem label={words.details} value={item.remarks} />
          )}
          <DetailItem
            label={words.currentApplicationState}
            value={`${operationLabel(language, "status", item.applicationStatus)} · ${operationLabel(language, "stage", item.workflowStage)}`}
          />
          {Object.keys(details).length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-[10px] font-medium text-slate-500">
                {words.details}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                {Object.entries(details)
                  .filter(([, value]) => value !== null && value !== "")
                  .map(([key, value]) => `${formatEnum(key)}: ${String(value)}`)
                  .join("\n")}
              </dd>
            </div>
          )}
        </dl>
        <Link
          href={`/applications/${encodeURIComponent(item.applicationId)}`}
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-[#12243d] px-3 text-xs font-medium text-white hover:bg-[#1b3555]"
        >
          {words.openApplication}
          <ExternalLink size={14} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-xs text-slate-800">{value}</dd>
    </div>
  );
}

function categoryLabel(
  category: HistoryRecord["category"],
  words: ReturnType<typeof getOperationsWords>,
) {
  if (category === "APPLICATION") return words.applicationCategory;
  if (category === "DOCUMENT") return words.documentCategory;
  return words.fieldCategory;
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
