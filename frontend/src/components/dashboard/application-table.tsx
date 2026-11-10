"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { getFieldVerificationCopy } from "@/lib/field-verification-i18n";
import {
  getApplications,
  type ApplicationList,
  type ApplicationWorkflowStage,
} from "@/lib/document-verification-api";
import type { ApplicationStatus } from "@/lib/dashboard-i18n";

type Props = {
  initialStatus?: "all" | ApplicationStatus;
  attentionOnly?: boolean;
};
type StageFilter = "all" | ApplicationWorkflowStage;
type SortKey =
  "applicationId" | "applicantName" | "village" | "submissionDate" | "priority";

const pageSize = 20;
const workflowStages: ApplicationWorkflowStage[] = [
  "DOCUMENT_VERIFICATION",
  "FIELD_VERIFICATION",
  "FINAL_REVIEW",
  "COMPLETED",
];

function initialStage(status: Props["initialStatus"]): StageFilter {
  switch (status) {
    case "documents":
      return "DOCUMENT_VERIFICATION";
    case "field":
      return "FIELD_VERIFICATION";
    case "review":
      return "FINAL_REVIEW";
    case "approved":
      return "COMPLETED";
    default:
      return "all";
  }
}

function dateLabel(value: string, language: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "kn" ? "kn-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function ApplicationTable({
  initialStatus = "all",
  attentionOnly = false,
}: Props) {
  const { language, t, search } = useDashboard();
  const fieldCopy = getFieldVerificationCopy(language);
  const [stage, setStage] = useState<StageFilter>(() =>
    initialStage(initialStatus),
  );
  const [priority, setPriority] = useState("all");
  const [tableSearch, setTableSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("submissionDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ApplicationList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const parameters = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sort: sortKey,
      order: sortOrder,
    });
    const term = [tableSearch.trim(), search.trim()].filter(Boolean).join(" ");
    if (term) parameters.set("search", term);
    if (stage !== "all") parameters.set("workflowStage", stage);
    if (priority !== "all") parameters.set("priority", priority.toUpperCase());
    if (attentionOnly) parameters.set("attentionOnly", "true");
    return parameters;
  }, [
    attentionOnly,
    page,
    priority,
    search,
    sortKey,
    sortOrder,
    stage,
    tableSearch,
  ]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      getApplications(query)
        .then((response) => {
          if (active) setResult(response);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setError(
            cause instanceof Error
              ? cause.message
              : language === "kn"
                ? "ಅರ್ಜಿಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ."
                : "Could not load applications.",
          );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [language, query]);

  function changeSort(nextKey: SortKey) {
    setPage(1);
    if (nextKey === sortKey) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(nextKey);
      setSortOrder(nextKey === "submissionDate" ? "desc" : "asc");
    }
  }

  const sortButton = (key: SortKey, label: string) => {
    const Icon =
      sortKey !== key ? ArrowUpDown : sortOrder === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => changeSort(key)}
        className="inline-flex items-center gap-1.5 text-left transition hover:text-slate-900"
        aria-label={`${t.table.sortBy}: ${label}`}
      >
        {label}
        <Icon size={12} aria-hidden="true" />
      </button>
    );
  };

  const hasRows = Boolean(result?.items.length);
  const totalPages = result?.totalPages ?? 0;
  const shownStart = result && result.total > 0 ? (page - 1) * pageSize + 1 : 0;
  const shownEnd = result
    ? Math.min((page - 1) * pageSize + result.items.length, result.total)
    : 0;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">{t.table.search}</span>
          <input
            type="search"
            value={tableSearch}
            onChange={(event) => {
              setTableSearch(event.target.value);
              setPage(1);
            }}
            placeholder={t.table.search}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <label>
            <span className="sr-only">{t.table.statusFilter}</span>
            <select
              value={stage}
              onChange={(event) => {
                setStage(event.target.value as StageFilter);
                setPage(1);
              }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10"
            >
              <option value="all">{t.table.allStatuses}</option>
              {workflowStages.map((item) => (
                <option key={item} value={item}>
                  {t.documentVerification.stage[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">{t.table.priorityFilter}</span>
            <select
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value);
                setPage(1);
              }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10"
            >
              <option value="all">{t.table.allPriorities}</option>
              {(["LOW", "NORMAL", "HIGH", "URGENT"] as const).map((item) => (
                <option key={item} value={item.toLowerCase()}>
                  {fieldCopy.priorityLabels[item]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
        >
          {error}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">
                  {sortButton("applicationId", t.table.applicationId)}
                </th>
                <th className="px-4 py-3">
                  {sortButton("applicantName", t.table.applicant)}
                </th>
                <th className="px-4 py-3">
                  {sortButton("village", t.table.village)}
                </th>
                <th className="px-4 py-3">
                  {sortButton("submissionDate", t.table.date)}
                </th>
                <th className="px-4 py-3">{t.table.stage}</th>
                <th className="px-4 py-3">
                  {sortButton("priority", t.table.priority)}
                </th>
                <th className="px-4 py-3">{t.table.officer}</th>
                <th className="px-4 py-3">{t.table.action}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hasRows &&
                result?.items.map((application) => (
                  <tr
                    key={application.id}
                    className="text-xs text-slate-700 transition hover:bg-slate-50/70"
                  >
                    <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-slate-800">
                      {application.id}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-800">
                      {application.applicantName}
                    </td>
                    <td className="px-4 py-3.5">{application.village}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      {dateLabel(application.submissionDate, language)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-800">
                        {
                          t.documentVerification.stage[
                            application.workflowStage
                          ]
                        }
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-500">
                        {
                          t.documentVerification.applicationStatus[
                            application.status
                          ]
                        }
                      </span>
                      {application.decisionStatus && (
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-1 text-[9px] font-medium ${
                            application.decisionStatus === "APPROVED"
                              ? "bg-emerald-50 text-emerald-800"
                              : application.decisionStatus === "REJECTED"
                                ? "bg-rose-50 text-rose-800"
                                : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {application.decisionStatus === "APPROVED"
                            ? t.status.approved
                            : application.decisionStatus === "REJECTED"
                              ? t.status.rejected
                              : t.status.returned}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {fieldCopy.priorityLabels[application.priority]}
                    </td>
                    <td className="px-4 py-3.5">
                      {application.assignedOfficer?.name ??
                        (language === "kn" ? "ನಿಯೋಜಿಸಿಲ್ಲ" : "Unassigned")}
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/applications/${encodeURIComponent(application.id)}`}
                        aria-label={`${t.table.openApplication}: ${application.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 font-semibold text-teal-800 transition hover:bg-teal-50 hover:text-teal-950"
                      >
                        {t.table.view}
                        <ExternalLink size={12} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              {!loading && !hasRows && (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      {t.table.noResults}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t.table.noResultsHint}
                    </p>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-xs text-slate-500"
                    aria-live="polite"
                  >
                    {language === "kn"
                      ? "ಅರ್ಜಿಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ…"
                      : "Loading applications…"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {t.table.showing} {shownStart}–{shownEnd} {t.table.of}{" "}
          {result?.total ?? 0} {t.table.applications}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
              className="rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {language === "kn" ? "ಹಿಂದೆ" : "Previous"}
            </button>
            <span aria-live="polite">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages || loading}
              className="rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {language === "kn" ? "ಮುಂದೆ" : "Next"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
