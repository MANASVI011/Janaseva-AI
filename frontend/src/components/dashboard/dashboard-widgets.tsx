"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  Clock3,
  FileCheck2,
  MapPinned,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { getDashboardHistory, getDashboardReport } from "@/lib/operations-api";
import type { HistoryRecord } from "@/lib/operations-api";

const emptyFilters = {
  fromDate: "",
  toDate: "",
  status: "",
  workflowStage: "",
  officerId: "",
  serviceType: "",
  search: "",
};

const activityStyle = {
  APPLICATION: "bg-blue-50 text-blue-700",
  DOCUMENT: "bg-teal-50 text-teal-700",
  FIELD: "bg-amber-50 text-amber-700",
} as const;

const activityIcons = {
  APPLICATION: FileCheck2,
  DOCUMENT: BadgeCheck,
  FIELD: MapPinned,
} as const;

const shortcuts = [
  {
    href: "/applications",
    label: "allApplications" as const,
    hint: "allApplicationsHint" as const,
    icon: ClipboardList,
    color: "bg-blue-50 text-blue-700",
  },
  {
    href: "/applications?status=review",
    label: "pendingReview" as const,
    hint: "pendingReviewHint" as const,
    icon: Clock3,
    color: "bg-amber-50 text-amber-700",
  },
  {
    href: "/field-verification",
    label: "fieldQueue" as const,
    hint: "fieldQueueHint" as const,
    icon: MapPinned,
    color: "bg-teal-50 text-teal-700",
  },
  {
    href: "/history",
    label: "history" as const,
    hint: "historyHint" as const,
    icon: FileCheck2,
    color: "bg-violet-50 text-violet-700",
  },
];

function formatActionLabel(action: string, language: "kn" | "en") {
  const map: Record<string, { en: string; kn: string }> = {
    APPLICATION_SUBMITTED: {
      en: "Application submitted",
      kn: "ಅರ್ಜಿ ಸಲ್ಲಿಸಲಾಗಿದೆ",
    },
    APPLICATION_APPROVED: {
      en: "Application approved",
      kn: "ಅರ್ಜಿ ಅನುಮೋದಿಸಲಾಗಿದೆ",
    },
    APPLICATION_REJECTED: {
      en: "Application rejected",
      kn: "ಅರ್ಜಿ ತಿರಸ್ಕರಿಸಲಾಗಿದೆ",
    },
    APPLICATION_RETURNED_FOR_CORRECTION: {
      en: "Application returned for correction",
      kn: "ಅರ್ಜಿ ತಿದ್ದುಪಡಿ үшін ಹಿಂತಿರುಗಿಸಲಾಗಿದೆ",
    },
    DOCUMENT_VERIFIED: {
      en: "Documents verified",
      kn: "ಡಾಕ್ಯುಮೆಂಟ್ಸ್ ಪರಿಶೀಲಿಸಲಾಗಿದೆ",
    },
    DOCUMENT_UPLOADED: {
      en: "Document uploaded",
      kn: "ಡಾಕ್ಯುಮೆಂಟ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಲಾಗಿದೆ",
    },
    DOCUMENT_REPLACED: {
      en: "Document replaced",
      kn: "ಡಾಕ್ಯುಮೆಂಟ್ ಬದಲಾಯಿಸಲಾಗಿದೆ",
    },
    FIELD_REPORT_SUBMITTED: {
      en: "Field verification report submitted",
      kn: "ಸ್ಥಳ ಸಮೀಕ್ಷೆ ವರದಿ ಸಲ್ಲಿಸಲಾಗಿದೆ",
    },
    FOLLOW_UP_REQUESTED: {
      en: "Follow-up requested",
      kn: "ಹೆಚ್ಚಿನ ಪರಿಶೀಲನೆ ವಿನಂತಿಸಲಾಗಿದೆ",
    },
    VISIT_SCHEDULED: {
      en: "Field visit scheduled",
      kn: "ಸ್ಥಳ ಭೇಟಿ ನಿಗದಿಪಡಿಸಲಾಗಿದೆ",
    },
    VISIT_RESCHEDULED: {
      en: "Field visit rescheduled",
      kn: "ಸ್ಥಳ ಭೇಟಿ ಮರುನಿಗದಿಪಡಿಸಲಾಗಿದೆ",
    },
  };

  return map[action]?.[language] ?? action.replace(/_/g, " ").toLowerCase();
}

function formatTime(value: string, language: "kn" | "en") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "kn" ? "kn-IN" : "en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function RecentActivity() {
  const { language, t } = useDashboard();
  const [items, setItems] = useState<HistoryRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getDashboardHistory(emptyFilters, 1, 5)
      .then((result) => {
        if (!active) return;
        setItems(result.items.slice(0, 5));
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load recent activity.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">
          {t.dashboard.activityTitle}
        </h2>
        <p className="mt-1 text-[10px] text-slate-500">
          {t.dashboard.activitySubtitle}
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500">No recent activity.</p>
      ) : (
        <ol className="space-y-4">
          {items.map((activity) => {
            const Icon = activityIcons[activity.category] ?? FileCheck2;
            return (
              <li
                key={activity.id}
                className="flex gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${activityStyle[activity.category]}`}
                >
                  <Icon size={15} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium leading-5 text-slate-800">
                    {formatActionLabel(activity.action, language)}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    {activity.applicantName} ·{" "}
                    <Link
                      href={`/applications/${activity.applicationId}`}
                      className="font-medium text-teal-700 hover:underline"
                    >
                      {activity.applicationId}
                    </Link>
                  </p>
                  <p className="mt-1 text-[9px] text-slate-400">
                    {formatTime(activity.occurredAt, language)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function QuickActions() {
  const { t } = useDashboard();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">
          {t.dashboard.quickTitle}
        </h2>
        <p className="mt-1 text-[10px] text-slate-500">
          {t.dashboard.quickSubtitle}
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {shortcuts.map(({ href, label, hint, icon: Icon, color }) => (
          <Link
            key={label}
            href={href}
            className="group flex items-center gap-3 py-3 first:pt-1 last:pb-1"
          >
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${color}`}
            >
              <Icon size={17} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-medium text-slate-800 group-hover:text-teal-800">
                {t.quick[label]}
              </span>
              <span className="mt-0.5 block text-[9px] leading-4 text-slate-500">
                {t.quick[hint]}
              </span>
            </span>
            <ArrowRight
              size={15}
              className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-700"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function StatCards() {
  const { language, t } = useDashboard();
  const [report, setReport] = useState<{
    totalApplications: number;
    pendingApplications: number;
    requiresAttention: number;
    approvedApplications: number;
  } | null>(null);
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    let active = true;
    getDashboardReport(emptyFilters, 1, 1)
      .then((result) => {
        if (!active) return;
        setReport({
          totalApplications: result.summary.totalApplications,
          pendingApplications: result.summary.pendingApplications,
          requiresAttention: result.summary.requiresAttention,
          approvedApplications: result.summary.approvedApplications,
        });
        setReportError("");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setReport(null);
        setReportError(
          cause instanceof Error
            ? cause.message
            : language === "kn"
              ? "ಅರ್ಜಿಗಳ ಅಂಕಿಅಂಶಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ."
              : "Could not load application metrics.",
        );
      });
    return () => {
      active = false;
    };
  }, [language]);

  const stats = [
    {
      key: "total" as const,
      value: report?.totalApplications,
      icon: UsersRound,
      iconClass: "bg-blue-50 text-blue-700",
    },
    {
      key: "pending" as const,
      value: report?.pendingApplications,
      icon: Clock3,
      iconClass: "bg-amber-50 text-amber-700",
    },
    {
      key: "attention" as const,
      value: report?.requiresAttention,
      icon: TriangleAlert,
      iconClass: "bg-rose-50 text-rose-700",
    },
    {
      key: "approved" as const,
      value: report?.approvedApplications,
      icon: BadgeCheck,
      iconClass: "bg-teal-50 text-teal-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ key, value, icon: Icon, iconClass }) => (
        <article
          key={key}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-slate-500">
                {t.stats[key]}
              </p>
              <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-slate-900">
                {value ?? "—"}
              </p>
            </div>
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
            >
              <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
            </span>
          </div>
          <div className="mt-4 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-slate-400" />
            <span
              role={reportError ? "alert" : undefined}
              className={`text-[10px] ${reportError ? "text-rose-700" : "text-slate-500"}`}
            >
              {reportError ||
                (report
                  ? t.table.dataSource
                  : language === "kn"
                    ? "ಲೋಡ್ ಆಗುತ್ತಿದೆ…"
                    : "Loading…")}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
