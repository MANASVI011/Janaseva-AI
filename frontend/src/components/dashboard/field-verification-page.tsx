"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  MapPinned,
  RotateCw,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { getAiAnalysisCopy } from "@/lib/ai-analysis-i18n";
import {
  assignFieldOfficer,
  getFieldApplication,
  getFieldQueue,
  requestFieldAssistance,
  rescheduleFieldVisit,
  saveFieldDraft,
  scheduleFieldVisit,
  startFieldVisit,
  submitFieldReport,
  type FieldApplicationDetail,
  type FieldChecklistAnswer,
  type FieldChecklistKey,
  type FieldQueueResponse,
  type FieldReportInput,
  type FieldScheduleInput,
  type FieldVerificationOutcome,
  type ApplicationWorkflowStage,
} from "@/lib/field-verification-api";
import { isDocumentDemoAuthEnabled } from "@/lib/document-verification-api";
import {
  getFieldChecklistLabel,
  getFieldVerificationCopy,
} from "@/lib/field-verification-i18n";

type ChecklistFormItem = {
  key: FieldChecklistKey;
  status: "" | FieldChecklistAnswer["status"];
  remarks: string;
};
type QueueFilters = {
  search: string;
  officer: string;
  visitStatus: string;
  applicationStatus: ApplicationWorkflowStage | "all";
  priority: string;
  from: string;
  to: string;
  sort: string;
  order: "asc" | "desc";
};

const initialFilters: QueueFilters = {
  search: "",
  officer: "all",
  visitStatus: "all",
  applicationStatus: "all",
  priority: "all",
  from: "",
  to: "",
  sort: "priority",
  order: "desc",
};

function inputDate(value: string | null) {
  if (!value) return "";
  const date = new Date(new Date(value).getTime() + 330 * 60_000);
  return date.toISOString().slice(0, 16);
}

function statusStyle(status: string) {
  if (status === "OVERDUE" || status === "FOLLOW_UP") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status === "SUBMITTED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "SCHEDULED" || status === "IN_PROGRESS") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function activityLabel(action: string, language: "kn" | "en") {
  const labels: Record<string, { kn: string; en: string }> = {
    OFFICER_ASSIGNED: { kn: "ಅಧಿಕಾರಿ ನಿಯೋಜಿಸಲಾಗಿದೆ", en: "Officer assigned" },
    OFFICER_REASSIGNED: {
      kn: "ಅಧಿಕಾರಿ ಮರುನಿಯೋಜಿಸಲಾಗಿದೆ",
      en: "Officer reassigned",
    },
    VISIT_SCHEDULED: { kn: "ಭೇಟಿ ನಿಗದಿಪಡಿಸಲಾಗಿದೆ", en: "Visit scheduled" },
    VISIT_RESCHEDULED: {
      kn: "ಭೇಟಿ ಮರುನಿಗದಿಪಡಿಸಲಾಗಿದೆ",
      en: "Visit rescheduled",
    },
    VISIT_STARTED: {
      kn: "ಸ್ಥಳ ಭೇಟಿ ಪ್ರಾರಂಭಿಸಲಾಗಿದೆ",
      en: "Field visit started",
    },
    REPORT_DRAFT_SAVED: {
      kn: "ವರದಿ ಕರಡು ಉಳಿಸಲಾಗಿದೆ",
      en: "Report draft saved",
    },
    FIELD_REPORT_SUBMITTED: {
      kn: "ವರದಿ ಸಲ್ಲಿಸಲಾಗಿದೆ",
      en: "Field report submitted",
    },
    FOLLOW_UP_REQUESTED: {
      kn: "ಹೆಚ್ಚಿನ ಪರಿಶೀಲನೆ ಕೋರಲಾಗಿದೆ",
      en: "Further verification requested",
    },
  };
  return labels[action]?.[language] ?? action.replaceAll("_", " ");
}

export function FieldVerificationPage() {
  const { language } = useDashboard();
  const aiCopy = getAiAnalysisCopy(language);
  const copy = getFieldVerificationCopy(language);
  const [filters, setFilters] = useState(initialFilters);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [queue, setQueue] = useState<FieldQueueResponse | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<FieldApplicationDetail | null>(null);
  const detailRequestSequence = useRef(0);
  const [selectedOfficer, setSelectedOfficer] = useState("");
  const [visitAt, setVisitAt] = useState("");
  const [visitVillage, setVisitVillage] = useState("");
  const [visitAddress, setVisitAddress] = useState("");
  const [instructions, setInstructions] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [checklist, setChecklist] = useState<ChecklistFormItem[]>([]);
  const [observations, setObservations] = useState("");
  const [outcome, setOutcome] = useState<FieldVerificationOutcome | "">("");
  const [remarks, setRemarks] = useState("");
  const [followUpRequested, setFollowUpRequested] = useState(false);
  const [actingOfficerId, setActingOfficerId] = useState("");
  const [assistantResult, setAssistantResult] = useState<{
    summary: string;
    questions: string[];
  } | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [pageError, setPageError] = useState("");
  const demoMode = isDocumentDemoAuthEnabled();

  const parameters = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "10",
      sort: filters.sort,
      order: filters.order,
      officer: filters.officer,
      visitStatus: filters.visitStatus,
      applicationStatus: filters.applicationStatus,
      priority: filters.priority,
    });
    if (filters.search) params.set("search", filters.search);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    return params;
  }, [filters, page]);

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    setPageError("");
    try {
      const result = await getFieldQueue(parameters);
      setQueue(result);
      setSelectedId((current) =>
        result.items.some((item) => item.applicationId === current)
          ? current
          : (result.items[0]?.applicationId ?? ""),
      );
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : copy.errors.load);
    } finally {
      setLoadingQueue(false);
    }
  }, [copy.errors.load, parameters]);

  const loadDetail = useCallback(
    async (applicationId: string) => {
      const requestSequence = ++detailRequestSequence.current;
      if (!applicationId) {
        setDetail(null);
        setLoadingDetail(false);
        return;
      }
      setLoadingDetail(true);
      setError("");
      try {
        const result = await getFieldApplication(applicationId);
        if (requestSequence !== detailRequestSequence.current) return;
        setDetail(result);
        const visit = result.verification;
        setSelectedOfficer(visit?.assignedOfficerId ?? "");
        setActingOfficerId((current) =>
          current && result.officers.some((officer) => officer.id === current)
            ? current
            : (visit?.assignedOfficerId ?? result.officers[0]?.id ?? ""),
        );
        setVisitAt(inputDate(visit?.scheduledAt ?? null));
        setVisitVillage(visit?.visitVillage ?? result.application.village);
        setVisitAddress(visit?.visitAddress ?? result.application.address);
        setInstructions(visit?.instructions ?? "");
        setInternalNotes(visit?.internalNotes ?? "");
        const savedAnswers = visit?.checklist ?? [];
        setChecklist(
          result.checklistItems.map((key) => {
            const existing = savedAnswers.find((answer) => answer.key === key);
            return {
              key,
              status: existing?.status ?? "",
              remarks: existing?.remarks ?? "",
            };
          }),
        );
        setObservations(visit?.observations ?? "");
        setOutcome(visit?.outcome ?? "");
        setRemarks(visit?.reportRemarks ?? "");
        setFollowUpRequested(visit?.followUpRequested ?? false);
        setAssistantResult(null);
      } catch (cause) {
        if (requestSequence !== detailRequestSequence.current) return;
        setDetail(null);
        setError(cause instanceof Error ? cause.message : copy.errors.load);
      } finally {
        if (requestSequence === detailRequestSequence.current) {
          setLoadingDetail(false);
        }
      }
    },
    [copy.errors.load],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadQueue(), 0);
    return () => window.clearTimeout(timer);
  }, [loadQueue]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDetail(selectedId), 0);
    return () => {
      window.clearTimeout(timer);
      detailRequestSequence.current += 1;
    };
  }, [loadDetail, selectedId]);

  const refreshCurrent = useCallback(async () => {
    await Promise.all([loadQueue(), loadDetail(selectedId)]);
  }, [loadDetail, loadQueue, selectedId]);

  const runAction = useCallback(
    async (
      action: string,
      execute: () => Promise<unknown>,
      successMessage: string,
      reloadDetail = true,
    ) => {
      if (busyAction) return;
      setBusyAction(action);
      setError("");
      setToast("");
      try {
        await execute();
        setToast(successMessage);
        if (reloadDetail) await loadDetail(selectedId);
        await loadQueue();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : copy.errors.action);
      } finally {
        setBusyAction("");
      }
    },
    [busyAction, copy.errors.action, loadDetail, loadQueue, selectedId],
  );

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setFilters((current) => ({ ...current, search: searchInput.trim() }));
  };

  const scheduleInput = (): FieldScheduleInput => ({
    scheduledAt: visitAt,
    village: visitVillage,
    address: visitAddress,
    instructions,
    internalNotes,
  });

  const answersForApi = (): FieldChecklistAnswer[] =>
    checklist
      .filter(
        (
          item,
        ): item is ChecklistFormItem & {
          status: FieldChecklistAnswer["status"];
        } => Boolean(item.status),
      )
      .map(({ key, status, remarks: itemRemarks }) => ({
        key,
        status,
        remarks: itemRemarks,
      }));

  const reportInput = (): FieldReportInput | null => {
    if (
      checklist.some((item) => !item.status) ||
      !observations.trim() ||
      !outcome
    ) {
      setError(copy.errors.completeChecklist);
      return null;
    }
    if (outcome !== "INFORMATION_SUPPORTED" && !remarks.trim()) {
      setError(copy.errors.outcomeRemarksRequired);
      return null;
    }
    return {
      checklist: answersForApi(),
      observations,
      outcome,
      remarks,
      followUpRequested,
    };
  };

  const selectedCase = queue?.items.find(
    (item) => item.applicationId === selectedId,
  );
  const selectedDetail = detail?.application.id === selectedId ? detail : null;
  const verification = selectedDetail?.verification ?? null;
  const canEditReport =
    Boolean(verification?.id) &&
    Boolean(verification?.assignedOfficerId) &&
    Boolean(actingOfficerId) &&
    actingOfficerId === verification?.assignedOfficerId &&
    verification?.status !== "SUBMITTED" &&
    verification?.status !== "FOLLOW_UP";
  const summaryCards = queue
    ? ([
        [copy.totalCases, queue.summary.totalCases, FileClock],
        [copy.pendingVisits, queue.summary.pendingVisits, MapPinned],
        [copy.scheduledVisits, queue.summary.scheduledVisits, ClipboardCheck],
        [copy.reportsSubmitted, queue.summary.reportsSubmitted, CheckCircle2],
        [
          copy.furtherVerification,
          queue.summary.furtherVerification,
          AlertCircle,
        ],
        [copy.overdueVisits, queue.summary.overdueVisits, RotateCw],
      ] as const)
    : [];

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-teal-800">
            {copy.demo}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {copy.title}
          </h1>
          <p className="mt-1 text-xs text-slate-500">{copy.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void refreshCurrent()}
          disabled={loadingQueue}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RotateCw size={14} aria-hidden="true" />
          {copy.retry}
        </button>
        {verification?.id &&
          (verification.visitStatus === "SCHEDULED" ||
            verification.visitStatus === "OVERDUE" ||
            verification.visitStatus === "DRAFT") && (
            <button
              type="button"
              disabled={!actingOfficerId || Boolean(busyAction)}
              onClick={() =>
                void runAction(
                  "start",
                  () =>
                    startFieldVisit(verification.id, {
                      demoOfficerId: actingOfficerId,
                    }),
                  copy.visitStarted,
                )
              }
              className="h-9 rounded-lg border border-teal-200 px-3 text-xs font-medium text-teal-800 disabled:opacity-50"
            >
              {copy.startVisit}
            </button>
          )}
      </header>

      {queue && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {summaryCards.map(([label, value, Icon]) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-3.5"
            >
              <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                <span>{label}</span>
                <Icon size={14} className="shrink-0 text-teal-700" />
              </div>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <form
          onSubmit={handleSearch}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6"
        >
          <label className="relative sm:col-span-2 xl:col-span-2">
            <span className="sr-only">{copy.search}</span>
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={copy.search}
              className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-teal-600"
            />
          </label>
          <button
            type="submit"
            className="h-9 rounded-lg bg-[#12243d] px-4 text-xs font-medium text-white hover:bg-[#1b3555]"
          >
            {copy.search}
          </button>
          <label>
            <span className="sr-only">{copy.officer}</span>
            <select
              value={filters.officer}
              aria-label={copy.officer}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  officer: event.target.value,
                }));
              }}
              className="h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/20"
            >
              <option value="all">{copy.allOfficers}</option>
              {(queue?.officers ?? []).map((officer) => (
                <option key={officer.id} value={officer.id}>
                  {officer.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">{copy.visitStatus}</span>
            <select
              value={filters.visitStatus}
              aria-label={copy.visitStatus}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  visitStatus: event.target.value,
                }));
              }}
              className="h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/20"
            >
              <option value="all">{copy.allStatuses}</option>
              {(
                [
                  "NOT_SCHEDULED",
                  "SCHEDULED",
                  "IN_PROGRESS",
                  "DRAFT",
                  "SUBMITTED",
                  "FOLLOW_UP",
                  "OVERDUE",
                ] as const
              ).map((status) => (
                <option key={status} value={status}>
                  {copy.status[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">{copy.applicationStatus}</span>
            <select
              value={filters.applicationStatus}
              aria-label={copy.applicationStatus}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  applicationStatus: event.target
                    .value as QueueFilters["applicationStatus"],
                }));
              }}
              className="h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/20"
            >
              <option value="all">{copy.allApplicationStatuses}</option>
              {(
                [
                  "DOCUMENT_VERIFICATION",
                  "FIELD_VERIFICATION",
                  "FINAL_REVIEW",
                  "COMPLETED",
                ] as const
              ).map((status) => (
                <option key={status} value={status}>
                  {copy.workflow[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">{copy.priorityFilter}</span>
            <select
              value={filters.priority}
              aria-label={copy.priorityFilter}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  priority: event.target.value,
                }));
              }}
              className="h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/20"
            >
              <option value="all">{copy.allPriorities}</option>
              {(["URGENT", "HIGH", "NORMAL", "LOW"] as const).map(
                (priority) => (
                  <option key={priority} value={priority}>
                    {copy.priorityLabels[priority]}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            <span className="sr-only">{copy.sort}</span>
            <select
              value={filters.sort}
              aria-label={copy.sort}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  sort: event.target.value,
                }));
              }}
              className="h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/20"
            >
              <option value="priority">{copy.priority}</option>
              <option value="applicationId">{copy.applicationId}</option>
              <option value="applicantName">{copy.applicant}</option>
              <option value="village">{copy.village}</option>
            </select>
          </label>
          <label>
            <span className="sr-only">{copy.sortOrder}</span>
            <select
              value={filters.order}
              aria-label={copy.sortOrder}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  order: event.target.value as QueueFilters["order"],
                }));
              }}
              className="h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/20"
            >
              <option value="asc">{copy.ascending}</option>
              <option value="desc">{copy.descending}</option>
            </select>
          </label>
          <label>
            <span className="sr-only">{copy.from}</span>
            <input
              type="date"
              value={filters.from}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  from: event.target.value,
                }));
              }}
              title={copy.from}
              aria-label={copy.from}
              className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
            />
          </label>
          <label>
            <span className="sr-only">{copy.to}</span>
            <input
              type="date"
              value={filters.to}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  to: event.target.value,
                }));
              }}
              title={copy.to}
              aria-label={copy.to}
              className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
            />
          </label>
        </form>
      </div>

      {pageError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800"
        >
          <span>{pageError}</span>
          <button
            type="button"
            onClick={() => void loadQueue()}
            className="font-semibold underline"
          >
            {copy.retry}
          </button>
        </div>
      )}
      {loadingQueue && !queue && (
        <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">
          {copy.loading}
        </p>
      )}

      {queue && (
        <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.7fr)]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {copy.title}
              </h2>
              <p className="mt-1 text-[10px] text-slate-500">
                {queue.total} · {copy.page} {queue.page} {copy.of}{" "}
                {Math.max(queue.totalPages, 1)}
              </p>
            </div>
            <div className="max-h-[720px] overflow-y-auto">
              {queue.items.length === 0 ? (
                <p className="p-5 text-xs text-slate-500">{copy.noCases}</p>
              ) : (
                queue.items.map((item) => (
                  <button
                    type="button"
                    key={item.applicationId}
                    onClick={() => setSelectedId(item.applicationId)}
                    className={`w-full border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 ${
                      selectedId === item.applicationId
                        ? "bg-teal-50/70"
                        : "bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">
                        {item.applicantName}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${statusStyle(item.visitStatus)}`}
                      >
                        {copy.status[item.visitStatus]}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {item.applicationId} · {item.village}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-slate-500">
                        {item.assignedOfficer?.name ?? copy.unassigned}
                      </span>
                      <span className="font-medium text-slate-700">
                        {copy.priorityLabels[item.priority]}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="flex items-center justify-between gap-2 p-3">
              <button
                type="button"
                disabled={page <= 1 || loadingQueue}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="h-8 rounded-md border border-slate-200 px-3 text-[10px] disabled:opacity-40"
              >
                {copy.previous}
              </button>
              <span className="text-[10px] text-slate-500">
                {copy.page} {queue.page} {copy.of}{" "}
                {Math.max(queue.totalPages, 1)}
              </span>
              <button
                type="button"
                disabled={page >= queue.totalPages || loadingQueue}
                onClick={() =>
                  setPage((value) => Math.min(queue.totalPages, value + 1))
                }
                className="h-8 rounded-md border border-slate-200 px-3 text-[10px] disabled:opacity-40"
              >
                {copy.next}
              </button>
            </div>
          </section>

          <section className="min-w-0 space-y-4">
            {loadingDetail ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                {copy.loading}
              </div>
            ) : selectedDetail ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-slate-500">
                        {selectedDetail.application.id}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-900">
                        {selectedDetail.application.applicantName}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedDetail.application.address ||
                          selectedDetail.application.village}
                        {selectedDetail.application.taluk
                          ? ` · ${selectedDetail.application.taluk}`
                          : ""}
                        {selectedDetail.application.district
                          ? ` · ${selectedDetail.application.district}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusStyle(verification?.visitStatus ?? "NOT_SCHEDULED")}`}
                    >
                      {
                        copy.status[
                          verification?.visitStatus ?? "NOT_SCHEDULED"
                        ]
                      }
                    </span>
                  </div>
                  {selectedDetail.application.annualFamilyIncome !== null && (
                    <p className="mt-3 text-xs text-slate-600">
                      {language === "kn"
                        ? "ವಾರ್ಷಿಕ ಕುಟುಂಬ ಆದಾಯ"
                        : "Annual family income"}
                      :{" "}
                      {new Intl.NumberFormat(
                        language === "kn" ? "kn-IN" : "en-IN",
                        {
                          style: "currency",
                          currency: "INR",
                          maximumFractionDigits: 0,
                        },
                      ).format(selectedDetail.application.annualFamilyIncome)}
                    </p>
                  )}
                  {error && (
                    <div
                      role="alert"
                      className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
                    >
                      {error}
                    </div>
                  )}
                  {toast && (
                    <div
                      role="status"
                      className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
                    >
                      {toast}
                    </div>
                  )}
                </div>

                <Link
                  href={`/applications/${encodeURIComponent(selectedId)}#ai-analysis`}
                  className="inline-flex min-h-9 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-800 hover:bg-blue-100"
                >
                  {aiCopy.analyze}
                </Link>

                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {copy.assigned}
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <select
                        aria-label={copy.assigned}
                        value={selectedOfficer}
                        onChange={(event) =>
                          setSelectedOfficer(event.target.value)
                        }
                        className="h-9 min-w-0 flex-1 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/20"
                      >
                        <option value="">{copy.unassigned}</option>
                        {selectedDetail.officers.map((officer) => (
                          <option key={officer.id} value={officer.id}>
                            {officer.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!selectedOfficer || Boolean(busyAction)}
                        onClick={() => {
                          if (!selectedId || !selectedOfficer) return;
                          void runAction(
                            "assign",
                            () =>
                              assignFieldOfficer(selectedId, selectedOfficer),
                            copy.assignmentSaved,
                          );
                        }}
                        className="h-9 rounded-lg bg-[#12243d] px-3 text-[10px] font-medium text-white disabled:opacity-50"
                      >
                        {busyAction === "assign"
                          ? "…"
                          : verification?.assignedOfficerId
                            ? copy.reassign
                            : copy.assign}
                      </button>
                    </div>
                    {demoMode && (
                      <label className="mt-4 block">
                        <span className="mb-1 block text-[10px] font-medium text-slate-600">
                          {copy.actingAs}
                        </span>
                        <select
                          value={actingOfficerId}
                          onChange={(event) =>
                            setActingOfficerId(event.target.value)
                          }
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                        >
                          <option value="">{copy.unassigned}</option>
                          {selectedDetail.officers.map((officer) => (
                            <option key={officer.id} value={officer.id}>
                              {officer.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {copy.scheduling}
                    </h3>
                    {!selectedDetail.eligibleForScheduling && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-900">
                        <p className="font-semibold">{copy.documentsBlocked}</p>
                        <p className="mt-1">{copy.missingDocuments}:</p>
                        <ul className="list-inside list-disc">
                          {selectedDetail.blockingDocuments.map((document) => (
                            <li key={`${document.category}:${document.label}`}>
                              {document.label || document.category}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="mt-3 grid gap-2">
                      <label className="text-[10px] text-slate-600">
                        {copy.scheduledAt}
                        <input
                          type="datetime-local"
                          value={visitAt}
                          onChange={(event) => setVisitAt(event.target.value)}
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                        />
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-[10px] text-slate-600">
                          {copy.visitVillage}
                          <input
                            value={visitVillage}
                            onChange={(event) =>
                              setVisitVillage(event.target.value)
                            }
                            className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                          />
                        </label>
                        <label className="text-[10px] text-slate-600">
                          {copy.visitAddress}
                          <input
                            value={visitAddress}
                            onChange={(event) =>
                              setVisitAddress(event.target.value)
                            }
                            className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                          />
                        </label>
                      </div>
                      <label className="text-[10px] text-slate-600">
                        {copy.instructions}
                        <textarea
                          rows={2}
                          value={instructions}
                          onChange={(event) =>
                            setInstructions(event.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                        />
                      </label>
                      <label className="text-[10px] text-slate-600">
                        {copy.internalNotes}
                        <textarea
                          rows={2}
                          value={internalNotes}
                          onChange={(event) =>
                            setInternalNotes(event.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={
                          !selectedDetail.eligibleForScheduling ||
                          !verification?.assignedOfficerId ||
                          !visitAt ||
                          Boolean(busyAction)
                        }
                        onClick={() => {
                          if (!selectedId) return;
                          const input = scheduleInput();
                          const scheduled = verification?.scheduledAt;
                          void runAction(
                            "schedule",
                            () =>
                              scheduled && verification?.id
                                ? rescheduleFieldVisit(verification.id, input)
                                : scheduleFieldVisit(selectedId, input),
                            copy.scheduleSaved,
                          );
                        }}
                        className="h-9 rounded-lg bg-teal-700 px-3 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {busyAction === "schedule"
                          ? "…"
                          : verification?.scheduledAt
                            ? copy.reschedule
                            : copy.schedule}
                      </button>
                    </div>
                  </section>
                </div>

                <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {copy.checklist}
                    </h3>
                    {demoMode && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-medium text-amber-800">
                        {copy.demo}
                      </span>
                    )}
                  </div>
                  {verification?.id && demoMode && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-slate-500">
                        {copy.actingAs}
                      </span>
                      <select
                        aria-label={copy.actingAs}
                        value={actingOfficerId}
                        onChange={(event) =>
                          setActingOfficerId(event.target.value)
                        }
                        className="h-8 max-w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-[10px] outline-none focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/20"
                      >
                        <option value="">{copy.unassigned}</option>
                        {selectedDetail.officers.map((officer) => (
                          <option key={officer.id} value={officer.id}>
                            {officer.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="mt-4 space-y-3">
                    {checklist.map((item) => (
                      <div
                        key={item.key}
                        className="grid gap-2 rounded-lg border border-slate-100 p-3 md:grid-cols-[minmax(180px,1fr)_180px_minmax(140px,0.8fr)] md:items-center"
                      >
                        <span className="text-xs font-medium text-slate-800">
                          {getFieldChecklistLabel(language, item.key)}
                        </span>
                        <select
                          aria-label={`${getFieldChecklistLabel(language, item.key)} — ${copy.chooseResult}`}
                          disabled={!canEditReport}
                          value={item.status}
                          onChange={(event) =>
                            setChecklist((current) =>
                              current.map((entry) =>
                                entry.key === item.key
                                  ? {
                                      ...entry,
                                      status: event.target
                                        .value as ChecklistFormItem["status"],
                                    }
                                  : entry,
                              ),
                            )
                          }
                          className="h-9 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-[10px] outline-none focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                        >
                          <option value="">{copy.chooseResult}</option>
                          <option value="VERIFIED">{copy.verified}</option>
                          <option value="NOT_VERIFIED">
                            {copy.notVerified}
                          </option>
                          <option value="UNABLE_TO_VERIFY">
                            {copy.unable}
                          </option>
                        </select>
                        <input
                          disabled={!canEditReport}
                          value={item.remarks}
                          onChange={(event) =>
                            setChecklist((current) =>
                              current.map((entry) =>
                                entry.key === item.key
                                  ? { ...entry, remarks: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                          placeholder={copy.remarks}
                          className="h-9 rounded-lg border border-slate-200 px-2 text-[10px] disabled:bg-slate-50"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="text-[10px] font-medium text-slate-600">
                      {copy.observations}
                      <textarea
                        rows={5}
                        disabled={!canEditReport}
                        value={observations}
                        onChange={(event) =>
                          setObservations(event.target.value)
                        }
                        placeholder={copy.observationsHint}
                        className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-xs disabled:bg-slate-50"
                      />
                    </label>
                    <div className="space-y-3">
                      <label className="block text-[10px] font-medium text-slate-600">
                        {copy.outcome}
                        <select
                          disabled={!canEditReport}
                          value={outcome}
                          onChange={(event) =>
                            setOutcome(
                              event.target.value as
                                FieldVerificationOutcome | "",
                            )
                          }
                          className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                        >
                          <option value="">{copy.chooseOutcome}</option>
                          <option value="INFORMATION_SUPPORTED">
                            {copy.supported}
                          </option>
                          <option value="DISCREPANCY_IDENTIFIED">
                            {copy.discrepancy}
                          </option>
                          <option value="APPLICANT_UNAVAILABLE">
                            {copy.applicantUnavailable}
                          </option>
                          <option value="FURTHER_VERIFICATION_REQUIRED">
                            {copy.further}
                          </option>
                        </select>
                      </label>
                      <label className="block text-[10px] font-medium text-slate-600">
                        {copy.reportRemarks}
                        <textarea
                          rows={3}
                          disabled={!canEditReport}
                          value={remarks}
                          onChange={(event) => setRemarks(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-xs disabled:bg-slate-50"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          disabled={!canEditReport}
                          checked={followUpRequested}
                          onChange={(event) =>
                            setFollowUpRequested(event.target.checked)
                          }
                          className="accent-teal-700"
                        />
                        {copy.followUp}
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canEditReport || Boolean(busyAction)}
                      onClick={() =>
                        verification?.id &&
                        void runAction(
                          "draft",
                          () =>
                            saveFieldDraft(
                              verification.id,
                              {
                                checklist: answersForApi(),
                                observations,
                                outcome: outcome || undefined,
                                remarks,
                                followUpRequested,
                              },
                              {
                                demoOfficerId: actingOfficerId,
                              },
                            ),
                          copy.draftSaved,
                        )
                      }
                      className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 disabled:opacity-40"
                    >
                      {busyAction === "draft" ? "…" : copy.saveDraft}
                    </button>
                    <button
                      type="button"
                      disabled={!canEditReport || Boolean(busyAction)}
                      onClick={() => {
                        const input = reportInput();
                        if (!input || !verification?.id) return;
                        void runAction(
                          "submit",
                          () =>
                            submitFieldReport(verification.id, input, {
                              demoOfficerId: actingOfficerId,
                            }),
                          followUpRequested ||
                            outcome === "FURTHER_VERIFICATION_REQUIRED"
                            ? copy.followUpSubmitted
                            : copy.reportSubmitted,
                        );
                      }}
                      className="h-9 rounded-lg bg-[#12243d] px-3 text-xs font-medium text-white disabled:opacity-40"
                    >
                      {busyAction === "submit" ? "…" : copy.submitReport}
                    </button>
                  </div>
                  {!canEditReport && (
                    <p className="mt-2 text-[10px] text-slate-500">
                      {verification ? copy.actingAs : copy.scheduling}
                    </p>
                  )}
                  {canEditReport && !verification?.scheduledAt && (
                    <p className="mt-2 text-[10px] leading-5 text-slate-500">
                      {copy.draftBeforeSchedule}
                    </p>
                  )}
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-teal-700" />
                    <h3 className="text-sm font-semibold text-slate-900">
                      {copy.assistance}
                    </h3>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() =>
                        void runAction(
                          "assist",
                          async () => {
                            const result = await requestFieldAssistance({
                              observations,
                              checklist: answersForApi(),
                            });
                            setAssistantResult({
                              summary: result.summary,
                              questions: result.suggestedQuestions,
                            });
                          },
                          "",
                          false,
                        )
                      }
                      className="ml-auto h-8 rounded-lg border border-teal-200 px-3 text-[10px] font-medium text-teal-800 disabled:opacity-50"
                    >
                      {busyAction === "assist" ? "…" : copy.assist}
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] leading-5 text-slate-500">
                    {copy.assistNotice}
                  </p>
                  {assistantResult && (
                    <div className="mt-3 rounded-lg bg-teal-50 p-3 text-xs text-teal-950">
                      <p>{assistantResult.summary}</p>
                      <p className="mt-2 font-semibold">
                        {copy.clarifyingQuestions}
                      </p>
                      {assistantResult.questions.length ? (
                        <ul className="mt-1 list-inside list-disc space-y-1">
                          {assistantResult.questions.map((question) => (
                            <li key={question}>{question}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1">{copy.noQuestions}</p>
                      )}
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <FileClock size={15} className="text-teal-700" />
                    {copy.activity}
                  </h3>
                  <ol className="mt-3 space-y-3">
                    {selectedDetail.history.length === 0 ? (
                      <li className="text-xs text-slate-500">
                        {copy.noActivity}
                      </li>
                    ) : (
                      selectedDetail.history.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex flex-wrap items-start justify-between gap-2 border-l-2 border-teal-200 pl-3"
                        >
                          <div>
                            <p className="text-xs font-medium text-slate-800">
                              {activityLabel(entry.action, language)}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              {entry.officer.name}
                            </p>
                            {entry.details && (
                              <div className="mt-1 space-y-0.5 text-[10px] text-slate-600">
                                {typeof entry.details.scheduledAt ===
                                  "string" && (
                                  <p>
                                    {copy.scheduledFor}:{" "}
                                    {new Intl.DateTimeFormat(
                                      language === "kn" ? "kn-IN" : "en-IN",
                                      {
                                        timeZone: "Asia/Kolkata",
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                      },
                                    ).format(
                                      new Date(entry.details.scheduledAt),
                                    )}
                                  </p>
                                )}
                                {typeof entry.details.outcome === "string" &&
                                  entry.details.outcome in
                                    copy.outcomeLabels && (
                                    <p>
                                      {copy.outcome}:{" "}
                                      {
                                        copy.outcomeLabels[
                                          entry.details
                                            .outcome as FieldVerificationOutcome
                                        ]
                                      }
                                    </p>
                                  )}
                                {typeof entry.details.observations ===
                                  "string" && (
                                  <p>
                                    {copy.observations}:{" "}
                                    {entry.details.observations}
                                  </p>
                                )}
                                {typeof entry.details.remarks === "string" &&
                                  entry.details.remarks && (
                                    <p>
                                      {copy.reportRemarks}:{" "}
                                      {entry.details.remarks}
                                    </p>
                                  )}
                                {typeof entry.details.assignedOfficerName ===
                                  "string" && (
                                  <p>
                                    {copy.assigned}:{" "}
                                    {entry.details.assignedOfficerName}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <time className="text-[10px] text-slate-400">
                            {new Intl.DateTimeFormat(
                              language === "kn" ? "kn-IN" : "en-IN",
                              {
                                timeZone: "Asia/Kolkata",
                                dateStyle: "medium",
                                timeStyle: "short",
                              },
                            ).format(new Date(entry.timestamp))}
                          </time>
                        </li>
                      ))
                    )}
                  </ol>
                </section>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                {selectedCase ? error || copy.selectCase : copy.selectCase}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
