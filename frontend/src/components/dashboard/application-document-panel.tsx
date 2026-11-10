"use client";

import Link from "next/link";
import Image from "next/image";
import {
  useCallback,
  createContext,
  useEffect,
  useRef,
  useState,
  useContext,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FileClock,
  FileText,
  History,
  LoaderCircle,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { PdfDocumentPreview } from "@/components/dashboard/pdf-document-preview";
import {
  DocumentApiError,
  fetchDocumentBlob,
  getApplicationDocuments,
  getApplicationHistory,
  markDocumentRequired,
  rejectDocument,
  requestDocumentReplacement,
  requestMissingDocuments,
  uploadApplicationDocument,
  verifyDocument,
  type ApplicationDocumentRecord,
  type ApplicationDocuments,
  type DocumentActivity,
  type DocumentCategory,
  type DocumentStatus,
} from "@/lib/document-verification-api";

type DialogAction =
  "verify" | "reject" | "replacement" | "required" | "missing";
type DocumentCopy = ReturnType<
  typeof useDashboard
>["t"]["documentVerification"];
type PanelCopy = DocumentCopy["page"];
const categories: DocumentCategory[] = [
  "IDENTITY_PROOF",
  "RATION_CARD",
  "INCOME_DECLARATION",
  "RESIDENCE_PROOF",
  "SUPPORTING_INCOME",
  "CASTE_CERTIFICATE",
  "OTHER",
];
const maxFileSize = 10 * 1024 * 1024;
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

function PanelCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <span className="text-teal-700">{icon}</span>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function StatusPill({
  status,
  label,
}: {
  status: DocumentStatus;
  label: string;
}) {
  const tone: Record<DocumentStatus, string> = {
    MISSING: "bg-slate-100 text-slate-700",
    PENDING_VERIFICATION: "bg-amber-50 text-amber-800",
    VERIFIED: "bg-emerald-50 text-emerald-700",
    REJECTED: "bg-rose-50 text-rose-700",
    REPLACEMENT_REQUESTED: "bg-violet-50 text-violet-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-1 text-[9px] font-medium ${tone[status]}`}
    >
      {label}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = "outline",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "outline" | "teal" | "danger";
}) {
  const tone = {
    outline: "border-slate-200 text-slate-600 hover:bg-slate-50",
    teal: "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100",
    danger: "border-rose-100 text-rose-700 hover:bg-rose-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[9px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${tone[variant]}`}
    >
      {children}
    </button>
  );
}

function ActionDialog({
  action,
  copy,
  busy,
  onClose,
  onSubmit,
}: {
  action: DialogAction;
  copy: PanelCopy;
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const requiresReason =
    action === "reject" ||
    action === "replacement" ||
    action === "required" ||
    action === "missing";

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      {action === "missing" ? (
        <fieldset>
          <legend className="mb-2 text-[10px] font-medium text-slate-700">
            {copy.selectMissing}
          </legend>
          <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
            <MissingDocumentChoices />
          </div>
        </fieldset>
      ) : null}
      {requiresReason && action !== "missing" && (
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-medium text-slate-700">
            {action === "reject"
              ? copy.rejectionReason
              : action === "replacement"
                ? copy.replacementReason
                : copy.reason}
          </span>
          <textarea
            name="reason"
            required
            rows={3}
            autoFocus
            placeholder={copy.reasonPlaceholder}
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-teal-600"
          />
        </label>
      )}
      {action === "verify" && (
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-medium text-slate-700">
            {copy.optionalRemark}
          </span>
          <textarea
            name="remarks"
            rows={3}
            autoFocus
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-teal-600"
          />
        </label>
      )}
      {(action === "reject" || action === "replacement") && (
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-medium text-slate-700">
            {copy.optionalRemark}
          </span>
          <textarea
            name="remarks"
            rows={2}
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-teal-600"
          />
        </label>
      )}
      {action === "missing" && (
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-medium text-slate-700">
            {copy.reason}
          </span>
          <textarea
            name="reason"
            required
            rows={3}
            placeholder={copy.reasonPlaceholder}
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-teal-600"
          />
        </label>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="h-9 rounded-lg border border-slate-200 px-3 text-[10px] font-medium text-slate-600"
        >
          {copy.cancel}
        </button>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#12243d] px-3 text-[10px] font-medium text-white disabled:opacity-50"
        >
          {busy && <LoaderCircle size={13} className="animate-spin" />}
          {action === "verify" && busy ? copy.verifying : copy.actionConfirm}
        </button>
      </div>
    </form>
  );
}

function MissingDocumentChoices() {
  const { t } = useDashboard();
  const context = useMissingContext();
  const candidates =
    context.documents?.filter((item) => item.status === "MISSING") ?? [];
  return candidates.length ? (
    candidates.map((document) => (
      <label
        key={`${document.category}:${document.label}`}
        className="flex gap-2 text-[10px] text-slate-700"
      >
        <input
          type="checkbox"
          checked={context.selected.includes(
            `${document.category}:${document.label}`,
          )}
          onChange={() =>
            context.toggle(`${document.category}:${document.label}`)
          }
          className="mt-0.5 accent-teal-700"
        />
        <span>
          {t.documentVerification.category[document.category]}
          {document.label ? ` · ${document.label}` : ""}
        </span>
      </label>
    ))
  ) : (
    <p className="text-[10px] text-slate-500">
      {t.documentVerification.page.noDocuments}
    </p>
  );
}

type MissingSelection = {
  documents: ApplicationDocumentRecord[] | null;
  selected: string[];
  toggle: (key: string) => void;
};
const MissingSelectionContext = createContext<MissingSelection>({
  documents: null,
  selected: [],
  toggle: () => undefined,
});
const useMissingContext = () => useContext(MissingSelectionContext);

export function ApplicationDocumentPanel({
  applicationId,
  onApplicationStatus,
  readOnly = false,
}: {
  applicationId: string;
  onApplicationStatus: (value: ApplicationDocuments["application"]) => void;
  readOnly?: boolean;
}) {
  const { language, t } = useDashboard();
  const hasDocumentApiAccess = true;
  const copy = t.documentVerification;
  const pageCopy = copy.page;
  const [data, setData] = useState<ApplicationDocuments | null>(null);
  const [history, setHistory] = useState<DocumentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [success, setSuccess] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("IDENTITY_PROOF");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dialog, setDialog] = useState<DialogAction | null>(null);
  const [activeDocument, setActiveDocument] =
    useState<ApplicationDocumentRecord | null>(null);
  const [selectedMissing, setSelectedMissing] = useState<string[]>([]);
  const [preview, setPreview] = useState<{
    url: string | null;
    blob: Blob | null;
    mimeType: string;
    document: ApplicationDocumentRecord;
    versionId?: string;
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [requiredDocument, setRequiredDocument] =
    useState<ApplicationDocumentRecord | null>(null);
  const [requiredReason, setRequiredReason] = useState("");
  const onStatusRef = useRef(onApplicationStatus);
  const previewRef = useRef(preview);
  const previewRequestId = useRef(0);
  const actionInFlight = useRef(false);

  useEffect(() => {
    onStatusRef.current = onApplicationStatus;
  }, [onApplicationStatus]);

  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  const loadData = useCallback(async () => {
    if (!hasDocumentApiAccess) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [applicationData, events] = await Promise.all([
        getApplicationDocuments(applicationId),
        getApplicationHistory(applicationId),
      ]);
      setData(applicationData);
      setHistory(events);
      setError("");
      onStatusRef.current(applicationData.application);
    } catch (cause) {
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
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [applicationId, copy, hasDocumentApiAccess]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  useEffect(
    () => () => {
      if (previewRef.current?.url) URL.revokeObjectURL(previewRef.current.url);
    },
    [],
  );

  function toggleMissing(key: string) {
    setSelectedMissing((current) =>
      current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key],
    );
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasDocumentApiAccess || !dialog || actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    const formData = new FormData(event.currentTarget);
    const reason = String(formData.get("reason") ?? "").trim();
    const remarks = String(formData.get("remarks") ?? "").trim();
    const optionalRemarks = remarks || undefined;
    try {
      if (dialog === "verify" && activeDocument?.id) {
        const result = await verifyDocument(activeDocument.id, optionalRemarks);
        if (
          result.document !== activeDocument.id ||
          result.version.status !== "VERIFIED"
        ) {
          throw new DocumentApiError(copy.invalidResponse, 502);
        }

        setData((current) => {
          if (!current) return current;
          const updated = {
            ...current,
            application: {
              ...current.application,
              status: result.application.status,
              workflowStage: result.application.workflowStage,
            },
            documents: current.documents.map((document) =>
              document.id !== result.document
                ? document
                : {
                    ...document,
                    status: result.version.status,
                    versions: document.versions.map((version) =>
                      version.id !== result.version.id
                        ? version
                        : {
                            ...version,
                            status: result.version.status,
                            verifiedAt: result.version.verifiedAt,
                            remarks: result.version.remarks,
                          },
                    ),
                    currentVersion:
                      document.currentVersion?.id === result.version.id
                        ? {
                            ...document.currentVersion,
                            status: result.version.status,
                            verifiedAt: result.version.verifiedAt,
                            remarks: result.version.remarks,
                          }
                        : document.currentVersion,
                  },
            ),
          };
          return updated;
        });
        if (data) {
          onStatusRef.current({
            ...data.application,
            status: result.application.status,
            workflowStage: result.application.workflowStage,
          });
        }
        setDialog(null);
        setActiveDocument(null);
        setSuccess(pageCopy.verifySuccess);

        try {
          const [applicationData, events] = await Promise.all([
            getApplicationDocuments(applicationId),
            getApplicationHistory(applicationId),
          ]);
          setData(applicationData);
          setHistory(events);
          onStatusRef.current(applicationData.application);
        } catch {
          setError(pageCopy.refreshAfterVerifyFailed);
        }
      } else if (dialog === "reject" && activeDocument?.id) {
        await rejectDocument(activeDocument.id, reason, optionalRemarks);
      } else if (dialog === "replacement" && activeDocument?.id) {
        await requestDocumentReplacement(
          activeDocument.id,
          reason,
          optionalRemarks,
        );
      } else if (dialog === "required" && requiredDocument?.id) {
        await markDocumentRequired(requiredDocument.id, reason.trim());
      } else if (dialog === "missing" && data) {
        const selected = data.documents.filter((document) =>
          selectedMissing.includes(`${document.category}:${document.label}`),
        );
        if (!selected.length) {
          setError(pageCopy.selectMissing);
          setBusy(false);
          return;
        }
        await requestMissingDocuments(
          applicationId,
          selected.map((document) => ({
            category: document.category,
            ...(document.label ? { label: document.label } : {}),
            reason,
          })),
        );
        setSelectedMissing([]);
      }
      if (dialog !== "verify") {
        setDialog(null);
        setActiveDocument(null);
        setRequiredDocument(null);
        setRequiredReason("");
        setSuccess(
          dialog === "missing"
            ? pageCopy.requestSuccess
            : pageCopy.updateSuccess,
        );
        await loadData();
      }
    } catch (cause) {
      setError(
        cause instanceof DocumentApiError && cause.status === 401
          ? copy.invalidToken
          : cause instanceof DocumentApiError && cause.status === 403
            ? copy.roleDenied
            : cause instanceof DocumentApiError && cause.status === 408
              ? copy.requestTimedOut
              : cause instanceof Error &&
                  cause.message &&
                  cause.message !== "request"
                ? cause.message
                : pageCopy.uploadFailed,
      );
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  }

  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasDocumentApiAccess || !file) {
      setError(pageCopy.noFileSelected);
      return;
    }
    if (!allowedTypes.has(file.type)) {
      setError(pageCopy.invalidFileType);
      return;
    }
    if (file.size > maxFileSize) {
      setError(pageCopy.fileTooLarge);
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    setProgress(0);
    try {
      await uploadApplicationDocument(
        applicationId,
        file,
        category,
        label.trim(),
        setProgress,
      );
      setFile(null);
      setLabel("");
      setSuccess(pageCopy.uploadSuccess);
      await loadData();
    } catch (cause) {
      setError(
        cause instanceof DocumentApiError && cause.status === 401
          ? copy.invalidToken
          : cause instanceof DocumentApiError && cause.status === 403
            ? copy.roleDenied
            : cause instanceof DocumentApiError && cause.status === 408
              ? copy.requestTimedOut
              : cause instanceof Error && cause.message !== "request"
                ? cause.message
                : pageCopy.uploadFailed,
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function previewDocument(
    document: ApplicationDocumentRecord,
    versionId?: string,
    download = false,
  ) {
    if (!document.id || !document.currentVersion || !hasDocumentApiAccess)
      return;
    const requestId = ++previewRequestId.current;
    const mimeType =
      document.versions.find((version) => version.id === versionId)?.mimeType ??
      document.currentVersion.mimeType;
    if (!download) {
      if (previewRef.current?.url) URL.revokeObjectURL(previewRef.current.url);
      setPreview({
        url: null,
        blob: null,
        mimeType,
        document,
        versionId,
        loading: true,
        error: null,
      });
    }
    setBusy(true);
    setError("");
    try {
      const blob = await fetchDocumentBlob(document.id, versionId, download);
      if (download) {
        const url = URL.createObjectURL(blob);
        const anchor = window.document.createElement("a");
        anchor.href = url;
        anchor.download = document.currentVersion.originalFilename;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        if (requestId !== previewRequestId.current) return;
        const url = mimeType.startsWith("image/")
          ? URL.createObjectURL(blob)
          : null;
        setPreview({
          url,
          blob,
          mimeType,
          document,
          versionId,
          loading: false,
          error: null,
        });
      }
      await loadData();
    } catch (cause) {
      const message =
        cause instanceof DocumentApiError && cause.status === 401
          ? copy.invalidToken
          : cause instanceof DocumentApiError && cause.status === 408
            ? copy.requestTimedOut
            : cause instanceof DocumentApiError
              ? cause.message
              : copy.apiError;
      if (!download && requestId === previewRequestId.current) {
        setPreview((current) =>
          current ? { ...current, loading: false, error: message } : current,
        );
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  const closePreview = () => {
    previewRequestId.current += 1;
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const dateLabel = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(language === "kn" ? "kn-IN" : "en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(value))
      : "—";
  const sizeLabel = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  if (!hasDocumentApiAccess) {
    return (
      <PanelCard title={pageCopy.title} icon={<FileText size={16} />}>
        <p className="text-xs leading-5 text-slate-600">
          {copy.authDescription}
        </p>
        <Link
          href="/document-verification"
          className="mt-3 inline-flex h-9 items-center rounded-lg bg-[#12243d] px-3 text-[10px] font-medium text-white"
        >
          {copy.authTitle}
        </Link>
      </PanelCard>
    );
  }

  return (
    <>
      <PanelCard
        title={`${pageCopy.title} · ${applicationId}`}
        icon={<FileCheck2 size={16} />}
      >
        {error && (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-rose-50 p-3 text-[10px] text-rose-800"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="mb-3 rounded-lg bg-emerald-50 p-3 text-[10px] text-emerald-800"
          >
            {success}
          </p>
        )}
        {data && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[10px] text-slate-600">
              <span className="font-semibold text-slate-800">
                {data.application.applicantName}
              </span>
              <span className="px-1.5 text-slate-300">·</span>
              {data.application.id}
            </p>
            <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-medium text-teal-800">
              {copy.applicationStatus[data.application.status]}
            </span>
          </div>
        )}
        {!readOnly && (
          <p className="mb-4 text-[10px] leading-5 text-slate-500">
            {pageCopy.uploadHelp}
          </p>
        )}
        {!readOnly && (
          <form
            onSubmit={uploadFile}
            className="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2"
          >
            <label>
              <span className="mb-1 block text-[9px] font-medium text-slate-600">
                {pageCopy.selectCategory}
              </span>
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as DocumentCategory)
                }
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-[10px] text-slate-700"
              >
                {categories.map((value) => (
                  <option key={value} value={value}>
                    {copy.category[value]}
                  </option>
                ))}
              </select>
            </label>
            {category === "OTHER" && (
              <label>
                <span className="mb-1 block text-[9px] font-medium text-slate-600">
                  {pageCopy.label}
                </span>
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  required
                  maxLength={100}
                  className="h-9 w-full rounded-md border border-slate-200 px-2 text-[10px]"
                />
              </label>
            )}
            <label className="sm:col-span-2">
              <span className="mb-1 block text-[9px] font-medium text-slate-600">
                {pageCopy.selectFile}
              </span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-[10px] file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-[10px]"
              />
              {file && (
                <span className="mt-1 block break-all text-[9px] text-slate-500">
                  {file.name} · {sizeLabel(file.size)}
                </span>
              )}
            </label>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2 sm:justify-between">
              {progress !== null && (
                <div className="flex min-w-40 flex-1 items-center gap-2">
                  <progress
                    aria-label={pageCopy.uploadProgress}
                    value={progress}
                    max={100}
                    className="h-1.5 flex-1 accent-teal-700"
                  />
                  <span className="text-[9px] text-slate-500">{progress}%</span>
                </div>
              )}
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[#12243d] px-3 text-[10px] font-medium text-white disabled:opacity-50"
              >
                <span className="relative inline-flex size-[13px] shrink-0">
                  <Upload
                    size={13}
                    className={`absolute inset-0 transition-opacity ${busy ? "opacity-0" : "opacity-100"}`}
                    aria-hidden="true"
                  />
                  <LoaderCircle
                    size={13}
                    className={`absolute inset-0 transition-opacity ${busy ? "animate-spin opacity-100" : "opacity-0"}`}
                    aria-hidden="true"
                  />
                </span>
                {pageCopy.uploadButton}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="py-8 text-center text-xs text-slate-500">
            {t.documentVerification.loading}
          </p>
        ) : !data ? (
          <p
            role={error ? "alert" : undefined}
            className="py-8 text-center text-xs text-rose-800"
          >
            {error || copy.apiError}
          </p>
        ) : data.documents.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">
            {pageCopy.noDocuments}
          </p>
        ) : (
          <div className="space-y-3">
            {data.documents.map((document) => (
              <DocumentItem
                key={`${document.category}:${document.label}:${document.id ?? "missing"}`}
                document={document}
                copy={pageCopy}
                categoryLabel={copy.category[document.category]}
                dateLabel={dateLabel}
                sizeLabel={sizeLabel}
                disabled={busy}
                onPreview={() => previewDocument(document)}
                onDownload={() =>
                  previewDocument(document, document.currentVersion?.id, true)
                }
                onVersion={(versionId) => previewDocument(document, versionId)}
                readOnly={readOnly}
                onAction={(action) => {
                  setActiveDocument(document);
                  setDialog(action);
                }}
                onRequired={() => {
                  setRequiredDocument(document);
                  setRequiredReason("");
                  setDialog("required");
                }}
              />
            ))}
          </div>
        )}

        {!readOnly && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <p className="text-[9px] leading-4 text-slate-500">
              {copy.demoOfficerNote}
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveDocument(null);
                setSelectedMissing([]);
                setDialog("missing");
              }}
              disabled={
                busy ||
                !data?.documents.some((item) => item.status === "MISSING")
              }
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-[9px] font-medium text-slate-600 disabled:opacity-40"
            >
              <FileText size={12} />
              {pageCopy.requestMissing}
            </button>
          </div>
        )}
      </PanelCard>

      <PanelCard
        title={pageCopy.applicationHistory}
        icon={<History size={16} />}
      >
        {history.length === 0 ? (
          <p className="text-xs text-slate-500">{pageCopy.historyEmpty}</p>
        ) : (
          <ol className="space-y-3">
            {history.map((event) => (
              <li key={event.id} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                  <FileClock size={13} />
                </span>
                <div className="min-w-0 flex-1 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="text-[10px] font-medium text-slate-800">
                      {pageCopy.actionName[
                        event.action as keyof typeof pageCopy.actionName
                      ] ?? event.action}
                    </p>
                    <time className="text-[9px] text-slate-400">
                      {dateLabel(event.timestamp)}
                    </time>
                  </div>
                  <p className="mt-1 text-[9px] text-slate-500">
                    {event.officer.name}
                    {event.document
                      ? ` · ${copy.category[event.document.category]}`
                      : ""}
                  </p>
                  {event.remarks && (
                    <p className="mt-1 text-[9px] leading-4 text-slate-500">
                      {event.remarks}
                    </p>
                  )}
                  {event.previousStatus && event.newStatus && (
                    <p className="mt-1 text-[9px] text-slate-400">
                      {copy.documentStatus[event.previousStatus]} →{" "}
                      {copy.documentStatus[event.newStatus]}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </PanelCard>

      {!readOnly && dialog && (
        <dialog
          open
          aria-label={
            dialog === "verify"
              ? pageCopy.verifyTitle
              : dialog === "reject"
                ? pageCopy.rejectTitle
                : dialog === "replacement"
                  ? pageCopy.replacementTitle
                  : dialog === "required"
                    ? pageCopy.markRequired
                    : pageCopy.missingRequest
          }
          className="fixed inset-0 z-[70] m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-950/45 sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {dialog === "verify"
                ? pageCopy.verifyTitle
                : dialog === "reject"
                  ? pageCopy.rejectTitle
                  : dialog === "replacement"
                    ? pageCopy.replacementTitle
                    : dialog === "required"
                      ? pageCopy.markRequired
                      : pageCopy.missingRequest}
            </h2>
            <button
              type="button"
              onClick={() => setDialog(null)}
              disabled={busy}
              aria-label={pageCopy.cancel}
              className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
            >
              <X size={15} />
            </button>
          </div>
          {dialog === "required" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitRequired();
              }}
              className="mt-4 space-y-3"
            >
              <label className="block">
                <span className="mb-1 block text-[10px] text-slate-600">
                  {pageCopy.reason}
                </span>
                <textarea
                  name="requiredReason"
                  required
                  rows={3}
                  value={requiredReason}
                  onChange={(event) => setRequiredReason(event.target.value)}
                  placeholder={pageCopy.reasonPlaceholder}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                />
              </label>
              <DialogFooter
                busy={busy}
                onClose={() => setDialog(null)}
                copy={pageCopy}
              />
            </form>
          ) : (
            <MissingSelectionContext.Provider
              value={{
                documents: data?.documents ?? null,
                selected: selectedMissing,
                toggle: toggleMissing,
              }}
            >
              <ActionDialog
                action={dialog}
                copy={pageCopy}
                busy={busy}
                onClose={() => setDialog(null)}
                onSubmit={(event) => void submitAction(event)}
              />
            </MissingSelectionContext.Provider>
          )}
        </dialog>
      )}

      {preview && (
        <dialog
          open
          aria-label={pageCopy.preview}
          className="fixed inset-0 z-[70] m-auto max-h-[95vh] w-[calc(100%-1rem)] max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl backdrop:bg-slate-950/45 sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">
                {pageCopy.preview}
              </h2>
              <p className="mt-1 break-all text-[10px] text-slate-500">
                {preview.document.currentVersion?.originalFilename} ·{" "}
                {data?.application.applicantName} · {applicationId}
              </p>
              {preview.document.currentVersion && (
                <p className="mt-1 text-[9px] text-slate-400">
                  {dateLabel(preview.document.currentVersion.uploadedAt)} ·{" "}
                  {copy.documentStatus[preview.document.currentVersion.status]}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ActionButton
                onClick={() =>
                  previewDocument(
                    preview.document,
                    preview.document.currentVersion?.id,
                    true,
                  )
                }
              >
                <Download size={12} />
                {pageCopy.download}
              </ActionButton>
              <button
                type="button"
                onClick={closePreview}
                aria-label={pageCopy.cancel}
                className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="mt-4 flex min-h-[50vh] items-center justify-center overflow-hidden rounded-lg bg-slate-100">
            {preview.loading ? (
              <div
                role="status"
                className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-xs text-slate-600"
              >
                <LoaderCircle
                  size={20}
                  className="animate-spin text-teal-700"
                />
                {pageCopy.previewLoading}
              </div>
            ) : preview.error ? (
              <div
                role="alert"
                className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center text-xs text-slate-700"
              >
                <p>{preview.error}</p>
                <ActionButton
                  onClick={() =>
                    previewDocument(preview.document, preview.versionId)
                  }
                  variant="teal"
                >
                  <RefreshCw size={12} />
                  {pageCopy.retryPreview}
                </ActionButton>
              </div>
            ) : preview.mimeType === "application/pdf" && preview.blob ? (
              <PdfDocumentPreview
                key={`${preview.document.id}:${preview.versionId ?? preview.document.currentVersion?.id ?? "current"}`}
                file={preview.blob}
                loadingLabel={pageCopy.previewLoading}
                errorLabel={pageCopy.previewFailed}
                retryLabel={pageCopy.retryPreview}
                pageLabel={pageCopy.previewPage}
                ofLabel={pageCopy.previewOf}
                previousLabel={pageCopy.previewPrevious}
                nextLabel={pageCopy.previewNext}
              />
            ) : preview.mimeType.startsWith("image/") && preview.url ? (
              <Image
                src={preview.url}
                alt={
                  preview.document.currentVersion?.originalFilename ??
                  pageCopy.preview
                }
                width={1600}
                height={1200}
                unoptimized
                className="max-h-[70vh] max-w-full object-contain transition-transform hover:scale-125"
                onError={() =>
                  setPreview((current) =>
                    current
                      ? {
                          ...current,
                          error: pageCopy.previewFailed,
                        }
                      : current,
                  )
                }
              />
            ) : (
              <div
                role="alert"
                className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-center text-xs text-slate-600"
              >
                <FileText size={22} />
                {pageCopy.previewUnsupported}
              </div>
            )}
          </div>
          <p className="mt-3 text-[9px] text-slate-500">
            {preview.document.currentVersion?.verifiedBy
              ? `${pageCopy.verifiedBy}: ${preview.document.currentVersion.verifiedBy.name} · ${dateLabel(preview.document.currentVersion.verifiedAt)}`
              : ""}
          </p>
        </dialog>
      )}
    </>
  );

  async function submitRequired() {
    if (!hasDocumentApiAccess || !requiredDocument?.id) return;
    setBusy(true);
    setError("");
    try {
      await markDocumentRequired(requiredDocument.id, requiredReason.trim());
      setDialog(null);
      setRequiredDocument(null);
      setSuccess(pageCopy.updateSuccess);
      await loadData();
    } catch {
      setError(copy.apiError);
    } finally {
      setBusy(false);
    }
  }
}

function DialogFooter({
  busy,
  onClose,
  copy,
}: {
  busy: boolean;
  onClose: () => void;
  copy: PanelCopy;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        disabled={busy}
        className="h-9 rounded-lg border border-slate-200 px-3 text-[10px] text-slate-600"
      >
        {copy.cancel}
      </button>
      <button
        type="submit"
        disabled={busy}
        className="h-9 rounded-lg bg-[#12243d] px-3 text-[10px] font-medium text-white disabled:opacity-50"
      >
        {copy.actionConfirm}
      </button>
    </div>
  );
}

function DocumentItem({
  document,
  copy,
  categoryLabel,
  dateLabel,
  sizeLabel,
  disabled,
  readOnly,
  onPreview,
  onDownload,
  onVersion,
  onAction,
  onRequired,
}: {
  document: ApplicationDocumentRecord;
  copy: PanelCopy;
  categoryLabel: string;
  dateLabel: (value: string | null) => string;
  sizeLabel: (bytes: number) => string;
  disabled: boolean;
  readOnly: boolean;
  onPreview: () => void;
  onDownload: () => void;
  onVersion: (versionId: string) => void;
  onAction: (action: Exclude<DialogAction, "required" | "missing">) => void;
  onRequired: () => void;
}) {
  const { t } = useDashboard();
  const version = document.currentVersion;
  const actionAvailable = !!document.id && !!version;
  return (
    <article className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-semibold text-slate-800">
              {categoryLabel}
              {document.label ? ` · ${document.label}` : ""}
            </h3>
            <StatusPill
              status={document.status}
              label={t.documentVerification.documentStatus[document.status]}
            />
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] text-slate-500">
              {document.required ? copy.required : copy.optional}
            </span>
          </div>
          {version ? (
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-[9px] sm:grid-cols-2 xl:grid-cols-3">
              <Metadata
                label={copy.originalFilename}
                value={version.originalFilename}
              />
              <Metadata
                label={copy.uploadedAt}
                value={dateLabel(version.uploadedAt)}
              />
              <Metadata
                label={copy.size}
                value={sizeLabel(version.sizeBytes)}
              />
              <Metadata label={copy.fileType} value={version.mimeType} />
              <Metadata
                label={copy.uploadedBy}
                value={version.uploadedBy.name}
              />
              {version.verifiedBy && (
                <Metadata
                  label={copy.verifiedBy}
                  value={`${version.verifiedBy.name} · ${dateLabel(version.verifiedAt)}`}
                />
              )}
              {document.requiredReason && (
                <Metadata label={copy.reason} value={document.requiredReason} />
              )}
              {version.remarks && (
                <Metadata label={copy.remarks} value={version.remarks} />
              )}
              {version.rejectionReason && (
                <Metadata
                  label={copy.rejectionReason}
                  value={version.rejectionReason}
                />
              )}
              {version.replacementReason && (
                <Metadata
                  label={copy.replacementReason}
                  value={version.replacementReason}
                />
              )}
            </dl>
          ) : document.requiredReason ? (
            <p className="mt-2 text-[9px] text-slate-500">
              {copy.reason}: {document.requiredReason}
            </p>
          ) : null}
          {document.versions.length > 1 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[9px] font-medium text-teal-800">
                {copy.viewVersions}
              </summary>
              <ul className="mt-2 space-y-1.5">
                {document.versions.slice(1).map((older) => (
                  <li
                    key={older.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-[9px]"
                  >
                    <span className="text-slate-600">
                      {copy.version} {older.version} · {older.originalFilename}{" "}
                      · {dateLabel(older.uploadedAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onVersion(older.id)}
                      className="text-teal-800 hover:underline"
                    >
                      {copy.preview}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {version && (
            <ActionButton onClick={onPreview} disabled={disabled}>
              <Eye size={12} />
              {copy.preview}
            </ActionButton>
          )}
          {version && (
            <ActionButton onClick={onDownload} disabled={disabled}>
              <Download size={12} />
            </ActionButton>
          )}
          {!readOnly && actionAvailable && version.status !== "VERIFIED" && (
            <>
              <ActionButton
                variant="teal"
                onClick={() => onAction("verify")}
                disabled={disabled}
              >
                <CheckCircle2 size={12} />
                {copy.verify}
              </ActionButton>
              <ActionButton
                variant="danger"
                onClick={() => onAction("reject")}
                disabled={disabled}
              >
                {copy.reject}
              </ActionButton>
              <ActionButton
                onClick={() => onAction("replacement")}
                disabled={disabled}
              >
                {copy.requestReplacement}
              </ActionButton>
            </>
          )}
          {!readOnly && !document.required && document.id && (
            <ActionButton onClick={onRequired} disabled={disabled}>
              {copy.markRequired}
            </ActionButton>
          )}
        </div>
      </div>
    </article>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-slate-700">{value}</dd>
    </div>
  );
}
