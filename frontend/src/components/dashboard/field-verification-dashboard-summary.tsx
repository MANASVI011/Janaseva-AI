"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPinned } from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import {
  getFieldQueue,
  type FieldVerificationSummary,
} from "@/lib/field-verification-api";

export function FieldVerificationDashboardSummary() {
  const { language, documentApiToken } = useDashboard();
  const [summary, setSummary] = useState<FieldVerificationSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getFieldQueue(
      new URLSearchParams({ page: "1", pageSize: "1" }),
      documentApiToken,
    )
      .then((result) => {
        if (active) setSummary(result.summary);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Request failed.");
        }
      });
    return () => {
      active = false;
    };
  }, [documentApiToken]);

  const labels =
    language === "kn"
      ? {
          title: "ಸ್ಥಳ ಪರಿಶೀಲನೆ ಅವಲೋಕನ",
          pending: "ಭೇಟಿ ಬಾಕಿ",
          scheduled: "ನಿಗದಿಪಡಿಸಿದ ಭೇಟಿಗಳು",
          inProgress: "ಪ್ರಗತಿಯಲ್ಲಿರುವ ಭೇಟಿಗಳು",
          reportsSubmitted: "ವರದಿಗಳು ಸಲ್ಲಿಸಲಾಗಿದೆ",
          followUp: "ಹೆಚ್ಚಿನ ಪರಿಶೀಲನೆ",
          overdue: "ತಡವಾದ ಭೇಟಿಗಳು",
          open: "ಸ್ಥಳ ಪರಿಶೀಲನೆ ತೆರೆಯಿರಿ",
          loading: "ಸ್ಥಳ ಪರಿಶೀಲನೆ ಅಂಕಿಅಂಶಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ…",
        }
      : {
          title: "Field verification overview",
          pending: "Visits pending",
          scheduled: "Scheduled visits",
          inProgress: "Visits in progress",
          reportsSubmitted: "Reports submitted",
          followUp: "Follow-up cases",
          overdue: "Overdue visits",
          open: "Open field verification",
          loading: "Loading field verification metrics…",
        };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MapPinned size={16} className="text-teal-700" aria-hidden="true" />
          {labels.title}
        </h2>
        <Link
          href="/field-verification"
          className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-800 hover:underline"
        >
          {labels.open}
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>
      {summary ? (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            [labels.pending, summary.pendingVisits],
            [labels.scheduled, summary.scheduledVisits],
            [labels.inProgress, summary.inProgressVisits],
            [labels.reportsSubmitted, summary.reportsSubmitted],
            [labels.followUp, summary.furtherVerification],
            [labels.overdue, summary.overdueVisits],
          ].map(([label, count]) => (
            <div key={label} className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {count}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p
          role={error ? "alert" : "status"}
          className={`mt-4 text-xs ${error ? "text-red-700" : "text-slate-500"}`}
        >
          {error || labels.loading}
        </p>
      )}
    </section>
  );
}
