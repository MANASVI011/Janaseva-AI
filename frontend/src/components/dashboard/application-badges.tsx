"use client";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import type {
  ApplicationPriority,
  ApplicationStatus,
} from "@/lib/dashboard-i18n";

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const { t } = useDashboard();
  const colors: Record<ApplicationStatus, string> = {
    review: "border-blue-100 bg-blue-50 text-blue-700",
    documents: "border-violet-100 bg-violet-50 text-violet-700",
    field: "border-amber-100 bg-amber-50 text-amber-800",
    approved: "border-emerald-100 bg-emerald-50 text-emerald-700",
    returned: "border-rose-100 bg-rose-50 text-rose-700",
    rejected: "border-slate-200 bg-slate-100 text-slate-700",
  };
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium ${colors[status]}`}
    >
      {t.status[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: ApplicationPriority }) {
  const { t } = useDashboard();
  const colors: Record<ApplicationPriority, string> = {
    high: "bg-rose-50 text-rose-700",
    normal: "bg-slate-100 text-slate-600",
    low: "bg-teal-50 text-teal-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-medium ${colors[priority]}`}
    >
      <span
        className={`size-1.5 rounded-full ${
          priority === "high"
            ? "bg-rose-500"
            : priority === "normal"
              ? "bg-slate-400"
              : "bg-teal-500"
        }`}
      />
      {t.priority[priority]}
    </span>
  );
}
