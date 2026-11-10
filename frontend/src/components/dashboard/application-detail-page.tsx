"use client";

import { ApplicationDocumentPanel } from "@/components/dashboard/application-document-panel";
import { ApplicationFieldVerificationSummary } from "@/components/dashboard/application-field-verification-summary";
import type { ApplicationWorkflowStage } from "@/lib/document-verification-api";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileCheck2,
  FileClock,
  FileText,
  Info,
  MapPinned,
  MessageSquareText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  PriorityBadge,
  StatusBadge,
} from "@/components/dashboard/application-badges";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import type {
  ApplicationHistoryEntry,
  DemoApplication,
  DocumentKey,
  HistoryKey,
  WorkflowStage,
} from "@/lib/demo-data";

type DialogKind = "approve" | "reject" | "return" | "request";
type AiAction = "summary" | "missing" | "inconsistency" | "checklist" | "field";
type HistoryCopyKey =
  | "actionSubmitted"
  | "actionDocumentsVerified"
  | "actionFieldSent"
  | "actionFieldReport"
  | "actionFinalReview"
  | "actionApproved"
  | "actionRejected"
  | "actionReturned"
  | "actionMissingRequested"
  | "actionDocumentVerified"
  | "actionReplacementRequested"
  | "actionReplacementReceived"
  | "actionOfficerComment";

const historyTranslationKeys: Record<HistoryKey, HistoryCopyKey> = {
  submitted: "actionSubmitted",
  documentsVerified: "actionDocumentsVerified",
  fieldSent: "actionFieldSent",
  fieldReport: "actionFieldReport",
  finalReview: "actionFinalReview",
  approved: "actionApproved",
  rejected: "actionRejected",
  returned: "actionReturned",
  missingRequested: "actionMissingRequested",
  documentVerified: "actionDocumentVerified",
  replacementRequested: "actionReplacementRequested",
  replacementReceived: "actionReplacementReceived",
  officerComment: "actionOfficerComment",
};

const workflowNameKeys: Record<
  "received" | WorkflowStage,
  | "stageReceived"
  | "stageDocuments"
  | "stageField"
  | "stageReview"
  | "stageDecision"
> = {
  received: "stageReceived",
  documents: "stageDocuments",
  field: "stageField",
  review: "stageReview",
  decision: "stageDecision",
};

function Card({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="text-teal-700">{icon}</span>
          {title}
        </h2>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function InformationItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs font-medium leading-5 text-slate-800">
        {value}
      </p>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "danger" | "teal";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const variants = {
    primary: "bg-[#12243d] text-white hover:bg-[#1b3555]",
    outline:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    teal: "bg-teal-700 text-white hover:bg-teal-800",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

function Overlay({
  title,
  closeLabel,
  children,
  onClose,
}: {
  title: string;
  closeLabel: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-950/45 sm:p-6"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label={closeLabel}
        >
          <X size={17} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function ApplicationDetailPage({
  application,
}: {
  application: DemoApplication;
}) {
  const { cases, language, t, updateCase } = useDashboard();
  const detail = cases[application.id];
  const copy = t.applicationDetail;
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [aiResponse, setAiResponse] = useState<string[] | null>(null);
  const [officerComment, setOfficerComment] = useState("");
  const [documentStatus, setDocumentStatus] = useState<{
    applicationId: string;
    verified: boolean;
    workflowStage: ApplicationWorkflowStage;
  } | null>(null);
  const updateFieldWorkflow = useCallback(
    ({
      workflowStage,
      documentsVerified,
    }: {
      workflowStage: ApplicationWorkflowStage;
      documentsVerified: boolean;
    }) => {
      setDocumentStatus({
        applicationId: application.id,
        verified: documentsVerified,
        workflowStage,
      });
    },
    [application.id],
  );

  if (!detail) {
    throw new Error(`Missing demonstration details for ${application.id}.`);
  }

  const terminal = detail.status === "approved" || detail.status === "rejected";
  const documentsComplete =
    documentStatus?.applicationId === application.id && documentStatus.verified;
  const workflowStage =
    documentStatus?.applicationId === application.id
      ? (
          {
            DOCUMENT_VERIFICATION: "documents",
            FIELD_VERIFICATION: "field",
            FINAL_REVIEW: "review",
            COMPLETED: "decision",
          } satisfies Record<ApplicationWorkflowStage, WorkflowStage>
        )[documentStatus.workflowStage]
      : detail.stage;
  const statusBadgeStatus =
    documentStatus?.applicationId === application.id &&
    detail.status !== "returned" &&
    detail.status !== "approved" &&
    detail.status !== "rejected"
      ? workflowStage === "decision"
        ? "review"
        : workflowStage
      : detail.status;
  const documentNames: Record<DocumentKey, string> = {
    identity: copy.documentNames.identity,
    ration: copy.documentNames.ration,
    income: copy.documentNames.incomeDeclaration,
    residence: copy.documentNames.residence,
    supporting: copy.documentNames.supportingIncome,
  };
  const dateLabel = (value: string, time = false) =>
    new Intl.DateTimeFormat(language === "kn" ? "kn-IN" : "en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(new Date(value));
  const incomeLabel = new Intl.NumberFormat(
    language === "kn" ? "kn-IN" : "en-IN",
    { style: "currency", currency: "INR", maximumFractionDigits: 0 },
  ).format(detail.annualIncome);
  const genderLabel =
    detail.gender[language] === "Woman" || detail.gender[language] === "ಮಹಿಳೆ"
      ? copy.woman
      : copy.man;

  function record(
    key: HistoryKey,
    comment?: string,
    update?: (previous: typeof detail) => Partial<typeof detail>,
  ) {
    updateCase(application.id, (previous) => ({
      ...previous,
      ...(update ? update(previous) : {}),
      history: [
        ...previous.history,
        {
          id: `${application.id}-${Date.now()}-${key}`,
          key,
          date: new Date().toISOString(),
          ...(comment ? { comment } : {}),
        },
      ],
    }));
  }

  function submitDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const comment = String(formData.get("message") ?? "").trim();

    if (dialog === "approve") {
      record("approved", undefined, () => ({
        status: "approved",
        stage: "decision",
      }));
    } else if (dialog === "reject") {
      record("rejected", comment, () => ({
        status: "rejected",
        stage: "decision",
      }));
    } else if (dialog === "return") {
      record("returned", comment, () => ({
        status: "returned",
        stage: "documents",
      }));
    } else if (dialog === "request") {
      record("missingRequested", comment, () => ({
        status: "returned",
        stage: "documents",
      }));
    }
    setDialog(null);
  }

  function runAiAction(action: AiAction) {
    const missingDocuments = detail.documents.filter(
      (document) => !document.uploaded || document.verification === "rejected",
    );
    const responses: Record<AiAction, string[]> = {
      summary: [
        `${copy.applicantInformation}: ${application.applicant[language]}`,
        `${copy.annualIncome}: ${incomeLabel}`,
        `${t.detail.status}: ${t.status[detail.status]}`,
      ],
      missing:
        missingDocuments.length > 0
          ? missingDocuments.map((document) => documentNames[document.key])
          : [copy.noMissing],
      inconsistency: [copy.inconsistencyHint],
      checklist: detail.documents.map(
        (document) =>
          `${documentNames[document.key]} — ${
            !document.uploaded ? copy.missing : copy[document.verification]
          }`,
      ),
      field: [...copy.fieldQuestionItems],
    };
    setAiResponse(responses[action]);
  }

  function addOfficerComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const comment = officerComment.trim();
    if (!comment) return;
    record("officerComment", comment);
    setOfficerComment("");
  }

  const stageIndex: Record<WorkflowStage, number> = {
    documents: 1,
    field: 2,
    review: 3,
    decision: 4,
  };
  const currentStageIndex = terminal
    ? 5
    : detail.status === "returned"
      ? 1
      : stageIndex[workflowStage];
  const stages = [
    { key: "received" as const, index: 0, date: application.date },
    {
      key: "documents" as const,
      index: 1,
      date:
        detail.status === "returned"
          ? detail.history.find((entry) => entry.key === "returned")?.date
          : (detail.history.find((entry) => entry.key === "documentsVerified")
              ?.date ?? application.date),
    },
    {
      key: "field" as const,
      index: 2,
      date: detail.history.find((entry) => entry.key === "fieldSent")?.date,
    },
    {
      key: "review" as const,
      index: 3,
      date: detail.history.find((entry) => entry.key === "finalReview")?.date,
    },
    {
      key: "decision" as const,
      index: 4,
      date: detail.history.find((entry) =>
        ["approved", "rejected", "returned"].includes(entry.key),
      )?.date,
    },
  ];

  const titleForDialog: Record<DialogKind, string> = {
    approve: copy.confirmApproveTitle,
    reject: copy.confirmRejectTitle,
    return: copy.confirmReturnTitle,
    request: copy.confirmRequestTitle,
  };
  const promptForDialog: Record<DialogKind, string> = {
    approve: copy.approvePrompt,
    reject: copy.rejectPrompt,
    return: copy.returnPrompt,
    request: copy.requestPrompt,
  };
  const placeholderForDialog: Record<Exclude<DialogKind, "approve">, string> = {
    reject: copy.reasonPlaceholder,
    return: copy.clarificationPlaceholder,
    request: copy.requestPlaceholder,
  };

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/applications"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-teal-800"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          {copy.back}
        </Link>
        <div className="mt-4 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-semibold text-slate-600">
                {application.id}
              </span>
              <StatusBadge status={statusBadgeStatus} />
              <PriorityBadge priority={application.priority} />
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {application.applicant[language]}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:min-w-[280px]">
            <InformationItem
              label={copy.submissionDate}
              value={dateLabel(application.date)}
            />
            <InformationItem
              label={t.detail.due}
              value={dateLabel(application.dueDate)}
            />
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 text-[10px] leading-5 text-slate-500">
          <Info size={14} className="mt-0.5 shrink-0 text-teal-700" />
          {copy.demoNotice}
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
        <div className="space-y-4">
          <Card
            title={copy.applicantInformation}
            icon={<UserRound size={16} />}
          >
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <InformationItem
                label={copy.fullName}
                value={application.applicant[language]}
              />
              <InformationItem
                label={copy.parentName}
                value={detail.parentName[language]}
              />
              <InformationItem
                label={copy.age}
                value={`${detail.age} ${copy.years}`}
              />
              <InformationItem label={copy.gender} value={genderLabel} />
              <InformationItem label={copy.mobile} value={detail.mobile} />
              <InformationItem
                label={copy.village}
                value={application.village[language]}
              />
              <InformationItem
                label={copy.hobli}
                value={detail.hobli[language]}
              />
              <InformationItem
                label={copy.taluk}
                value={detail.taluk[language]}
              />
              <InformationItem
                label={copy.district}
                value={detail.district[language]}
              />
              <div className="sm:col-span-2 lg:col-span-3">
                <InformationItem
                  label={copy.address}
                  value={detail.address[language]}
                />
              </div>
            </div>
          </Card>

          <Card
            title={copy.applicationInformation}
            icon={<FileText size={16} />}
          >
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              <InformationItem
                label={copy.service}
                value={copy.incomeCertificate}
              />
              <InformationItem
                label={copy.purpose}
                value={detail.purpose[language]}
              />
              <InformationItem label={copy.annualIncome} value={incomeLabel} />
              <InformationItem
                label={copy.family}
                value={detail.familyDetails[language]}
              />
              <InformationItem
                label={copy.submissionDate}
                value={dateLabel(application.date)}
              />
              <InformationItem
                label={copy.assignedOfficer}
                value={application.officer[language]}
              />
            </div>
          </Card>

          <ApplicationDocumentPanel
            applicationId={application.id}
            onApplicationStatus={(value) =>
              setDocumentStatus({
                applicationId: application.id,
                verified: value.status === "DOCUMENTS_VERIFIED",
                workflowStage: value.workflowStage,
              })
            }
          />

          <ApplicationFieldVerificationSummary
            applicationId={application.id}
            onWorkflowStateChange={updateFieldWorkflow}
          />

          <Card title={copy.workflowTitle} icon={<MapPinned size={16} />}>
            <ol className="space-y-0">
              {stages.map((stage, index) => {
                const done = stage.index < currentStageIndex;
                const current = stage.index === currentStageIndex;
                const latestComment = detail.history
                  .slice()
                  .reverse()
                  .find((entry) => entry.comment)?.comment;
                return (
                  <li
                    key={stage.key}
                    className="relative flex gap-3 pb-5 last:pb-0"
                  >
                    {index < stages.length - 1 && (
                      <span className="absolute bottom-0 left-[11px] top-6 w-px bg-slate-200" />
                    )}
                    <span
                      className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full ${
                        done
                          ? "bg-teal-700 text-white"
                          : current
                            ? "border-2 border-teal-700 bg-white text-teal-700"
                            : "border border-slate-200 bg-white text-slate-300"
                      }`}
                    >
                      {done ? (
                        <Check size={13} />
                      ) : current ? (
                        <span className="size-1.5 rounded-full bg-teal-700" />
                      ) : (
                        <Circle size={12} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p
                          className={`text-xs font-semibold ${
                            current ? "text-teal-800" : "text-slate-800"
                          }`}
                        >
                          {copy[workflowNameKeys[stage.key]]}
                        </p>
                        <span
                          className={`text-[9px] font-medium ${
                            done
                              ? "text-teal-700"
                              : current
                                ? "text-blue-700"
                                : "text-slate-400"
                          }`}
                        >
                          {done
                            ? copy.completed
                            : current
                              ? copy.current
                              : copy.upcoming}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {stage.index === 0
                          ? application.officer[language]
                          : stage.index === 2
                            ? `${copy.assignedVaRi}: ${application.officer[language]}`
                            : application.officer[language]}
                        <span className="px-1.5 text-slate-300">·</span>
                        {stage.date ? dateLabel(stage.date) : copy.dateUnknown}
                      </p>
                      {current && detail.status === "returned" && (
                        <p className="mt-1 text-[10px] font-medium text-rose-700">
                          {t.status.returned}
                        </p>
                      )}
                      {current && latestComment && (
                        <p className="mt-2 rounded-md bg-slate-50 px-2.5 py-2 text-[10px] leading-5 text-slate-600">
                          <span className="font-medium">{copy.comments}: </span>
                          {latestComment}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card title={copy.historyTitle} icon={<FileClock size={16} />}>
            {detail.history.length === 0 ? (
              <p className="text-xs text-slate-500">{copy.noHistory}</p>
            ) : (
              <ol className="space-y-4">
                {detail.history
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <HistoryRow
                      key={entry.id}
                      entry={entry}
                      officer={application.officer[language]}
                      eventName={copy[historyTranslationKeys[entry.key]]}
                      dateLabel={dateLabel(entry.date, true)}
                    />
                  ))}
              </ol>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card
            title={copy.aiTitle}
            icon={<Bot size={16} />}
            action={
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-[9px] font-medium text-violet-700">
                <Sparkles size={11} />
                {copy.aiDemo}
              </span>
            }
          >
            <p className="mb-3 text-[10px] leading-5 text-slate-500">
              {copy.aiHint}
            </p>
            <div className="grid grid-cols-1 gap-2">
              {(
                [
                  ["summary", copy.summarize],
                  ["missing", copy.findMissing],
                  ["inconsistency", copy.inconsistencies],
                  ["checklist", copy.checklist],
                  ["field", copy.fieldQuestions],
                ] as const
              ).map(([action, label]) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => runAiAction(action)}
                  className="flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-[10px] font-medium text-slate-700 transition hover:border-teal-200 hover:bg-teal-50/50 hover:text-teal-900"
                >
                  <Sparkles size={13} className="shrink-0 text-teal-700" />
                  {label}
                </button>
              ))}
            </div>
            {aiResponse && (
              <div
                className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3"
                aria-live="polite"
              >
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-blue-900">
                  <Bot size={13} />
                  {copy.aiResponse}
                </p>
                <ul className="space-y-1.5 text-[10px] leading-5 text-slate-700">
                  {aiResponse.map((item, index) => (
                    <li key={`${index}-${item}`} className="flex gap-2">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-blue-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-4 flex gap-2 rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-[10px] leading-5 text-amber-900">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              {copy.aiNotice}
            </p>
          </Card>

          <Card title={copy.actionsTitle} icon={<ShieldCheck size={16} />}>
            {terminal ? (
              <p className="flex gap-2 rounded-lg bg-slate-50 p-3 text-[10px] leading-5 text-slate-600">
                <CheckCircle2
                  size={14}
                  className="mt-0.5 shrink-0 text-teal-700"
                />
                {copy.terminalMessage}
              </p>
            ) : (
              <div className="space-y-2">
                {workflowStage === "documents" && (
                  <ActionButton
                    variant="teal"
                    disabled={!documentsComplete}
                    onClick={() =>
                      record("fieldSent", undefined, () => ({
                        status: "field",
                        stage: "field",
                        fieldReportSubmitted: false,
                      }))
                    }
                  >
                    <MapPinned size={14} />
                    {copy.sendField}
                  </ActionButton>
                )}
                {workflowStage === "field" && !detail.fieldReportSubmitted && (
                  <ActionButton
                    variant="teal"
                    onClick={() =>
                      record("fieldReport", undefined, () => ({
                        fieldReportSubmitted: true,
                      }))
                    }
                  >
                    <FileCheck2 size={14} />
                    {copy.submitFieldReport}
                  </ActionButton>
                )}
                {workflowStage === "field" && detail.fieldReportSubmitted && (
                  <ActionButton
                    variant="teal"
                    onClick={() =>
                      record("finalReview", undefined, () => ({
                        status: "review",
                        stage: "review",
                      }))
                    }
                  >
                    <ClipboardCheck size={14} />
                    {copy.moveFinalReview}
                  </ActionButton>
                )}
                {workflowStage === "review" && (
                  <>
                    <ActionButton
                      variant="teal"
                      onClick={() => setDialog("approve")}
                    >
                      <CheckCircle2 size={14} />
                      {copy.approve}
                    </ActionButton>
                    <ActionButton
                      variant="danger"
                      onClick={() => setDialog("reject")}
                    >
                      <X size={14} />
                      {copy.reject}
                    </ActionButton>
                    <ActionButton
                      variant="outline"
                      onClick={() => setDialog("return")}
                    >
                      <MessageSquareText size={14} />
                      {copy.returnClarification}
                    </ActionButton>
                  </>
                )}
                {detail.status === "returned" && (
                  <p className="rounded-lg bg-amber-50 p-3 text-[10px] leading-5 text-amber-900">
                    {copy.returnedInstructions}
                  </p>
                )}
              </div>
            )}
            {!terminal && (
              <form
                onSubmit={addOfficerComment}
                className="mt-4 border-t border-slate-100 pt-4"
              >
                <label
                  htmlFor="officer-comment"
                  className="mb-1.5 block text-[10px] font-medium text-slate-600"
                >
                  {copy.addComment}
                </label>
                <textarea
                  id="officer-comment"
                  value={officerComment}
                  onChange={(event) => setOfficerComment(event.target.value)}
                  rows={3}
                  required
                  className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
                  placeholder={copy.commentPlaceholder}
                />
                <div className="mt-2 flex justify-end">
                  <ActionButton type="submit" variant="outline">
                    <MessageSquareText size={13} />
                    {copy.saveComment}
                  </ActionButton>
                </div>
              </form>
            )}
          </Card>
          <p className="flex gap-2 rounded-lg border border-slate-200 bg-white p-3 text-[10px] leading-5 text-slate-500">
            <Info size={14} className="mt-0.5 shrink-0 text-teal-700" />
            {copy.decisionNotice}
          </p>
        </aside>
      </div>

      {dialog && (
        <Overlay
          title={titleForDialog[dialog]}
          closeLabel={copy.close}
          onClose={() => setDialog(null)}
        >
          <form onSubmit={submitDialog} className="mt-4 space-y-4">
            <p className="text-xs leading-5 text-slate-600">
              {promptForDialog[dialog]}
            </p>
            {dialog !== "approve" && (
              <textarea
                name="message"
                rows={4}
                required
                autoFocus
                placeholder={placeholderForDialog[dialog]}
                className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
              />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <ActionButton variant="outline" onClick={() => setDialog(null)}>
                {copy.cancel}
              </ActionButton>
              <ActionButton
                type="submit"
                variant={dialog === "reject" ? "danger" : "primary"}
              >
                {copy.confirm}
              </ActionButton>
            </div>
          </form>
        </Overlay>
      )}
    </div>
  );
}

function HistoryRow({
  entry,
  officer,
  eventName,
  dateLabel,
}: {
  entry: ApplicationHistoryEntry;
  officer: string;
  eventName: string;
  dateLabel: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
        {entry.key === "submitted" ? (
          <FileText size={13} />
        ) : entry.key === "fieldReport" ? (
          <MapPinned size={13} />
        ) : entry.key === "officerComment" ? (
          <MessageSquareText size={13} />
        ) : (
          <CheckCircle2 size={13} />
        )}
      </span>
      <div className="min-w-0 flex-1 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-xs font-medium text-slate-800">{eventName}</p>
          <time className="text-[9px] text-slate-400">{dateLabel}</time>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">{officer}</p>
        {entry.comment && (
          <p className="mt-2 rounded-md bg-slate-50 px-2.5 py-2 text-[10px] leading-5 text-slate-600">
            {entry.comment}
          </p>
        )}
      </div>
    </li>
  );
}
