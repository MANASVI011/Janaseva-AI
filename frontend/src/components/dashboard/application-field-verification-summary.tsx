"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MapPinned } from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import {
  getFieldApplication,
  type ApplicationWorkflowStage,
} from "@/lib/field-verification-api";
import { getFieldVerificationCopy } from "@/lib/field-verification-i18n";

export function ApplicationFieldVerificationSummary({
  applicationId,
  onWorkflowStateChange,
}: {
  applicationId: string;
  onWorkflowStateChange?: (state: {
    workflowStage: ApplicationWorkflowStage;
    documentsVerified: boolean;
  }) => void;
}) {
  const { language, documentApiToken } = useDashboard();
  const copy = getFieldVerificationCopy(language);
  const [detail, setDetail] = useState<Awaited<
    ReturnType<typeof getFieldApplication>
  > | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getFieldApplication(applicationId, documentApiToken)
      .then((result) => {
        if (active) {
          setDetail(result);
          setError("");
          onWorkflowStateChange?.({
            workflowStage: result.application.workflowStage,
            documentsVerified:
              result.application.documentStatus === "DOCUMENTS_VERIFIED",
          });
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : copy.errors.load);
        }
      });
    return () => {
      active = false;
    };
  }, [
    applicationId,
    copy.errors.load,
    documentApiToken,
    onWorkflowStateChange,
  ]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MapPinned size={16} className="text-teal-700" aria-hidden="true" />
          {copy.title}
        </h2>
        <Link
          href="/field-verification"
          className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-800 hover:underline"
        >
          {language === "kn" ? "ಕಾರ್ಯಸ್ಥಳ ತೆರೆಯಿರಿ" : "Open workspace"}
          <ArrowUpRight size={13} aria-hidden="true" />
        </Link>
      </div>
      <div className="p-4 sm:p-5">
        {error ? (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        ) : !detail ? (
          <p className="text-xs text-slate-500">{copy.loading}</p>
        ) : (
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <p>
              <span className="text-slate-500">{copy.visit}: </span>
              <span className="font-medium text-slate-800">
                {
                  copy.status[
                    detail.verification?.visitStatus ?? "NOT_SCHEDULED"
                  ]
                }
              </span>
            </p>
            <p>
              <span className="text-slate-500">{copy.assigned}: </span>
              <span className="font-medium text-slate-800">
                {detail.verification?.assignedOfficer?.name ?? copy.unassigned}
              </span>
            </p>
            <p className="sm:col-span-2">
              <span className="text-slate-500">{copy.scheduledAt}: </span>
              <span className="font-medium text-slate-800">
                {detail.verification?.scheduledAt
                  ? new Intl.DateTimeFormat(
                      language === "kn" ? "kn-IN" : "en-IN",
                      {
                        timeZone: "Asia/Kolkata",
                        dateStyle: "medium",
                        timeStyle: "short",
                      },
                    ).format(new Date(detail.verification.scheduledAt))
                  : "—"}
              </span>
            </p>
            <p className="sm:col-span-2">
              <span className="text-slate-500">{copy.workflowStage}: </span>
              <span className="font-medium text-slate-800">
                {copy.workflow[detail.application.workflowStage]}
              </span>
            </p>
            {!detail.eligibleForScheduling && (
              <p className="sm:col-span-2 text-amber-800">
                {copy.documentsBlocked}
              </p>
            )}
            {detail.verification?.outcome && (
              <p className="sm:col-span-2 text-slate-700">
                {copy.outcome}:{" "}
                {detail.verification.outcome.replaceAll("_", " ")}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
