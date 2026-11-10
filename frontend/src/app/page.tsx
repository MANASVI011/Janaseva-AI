"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, ShieldCheck } from "lucide-react";
import { ApplicationTable } from "@/components/dashboard/application-table";
import { FieldVerificationDashboardSummary } from "@/components/dashboard/field-verification-dashboard-summary";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import {
  QuickActions,
  RecentActivity,
  StatCards,
} from "@/components/dashboard/dashboard-widgets";

export default function DashboardPage() {
  const { language, t } = useDashboard();

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-teal-600" />
            <p className="text-[10px] font-semibold tracking-[0.13em] text-teal-800">
              {t.dashboard.eyebrow}
            </p>
          </div>
          <h2 className="text-[25px] font-semibold tracking-tight text-slate-900 sm:text-[28px]">
            {t.dashboard.title}
          </h2>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500">
            {t.dashboard.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <CalendarDays size={14} className="text-slate-400" />
          <span>
            {t.dashboard.updated} ·{" "}
            {new Intl.DateTimeFormat(language === "kn" ? "kn-IN" : "en-IN", {
              timeZone: "Asia/Kolkata",
              day: "2-digit",
              month: "short",
              year: "numeric",
            }).format(new Date())}
          </span>
        </div>
      </section>

      <section aria-labelledby="overview-heading" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2
              id="overview-heading"
              className="text-sm font-semibold text-slate-900"
            >
              {t.dashboard.overview}
            </h2>
            <p className="mt-1 text-[10px] text-slate-500">
              {t.dashboard.overviewNote}
            </p>
          </div>
          <span className="hidden items-center gap-1.5 text-[10px] text-slate-400 sm:inline-flex">
            <ShieldCheck size={13} className="text-teal-700" />
            {t.dashboard.service}
          </span>
        </div>
        <StatCards />
      </section>

      <FieldVerificationDashboardSummary />

      <section aria-labelledby="attention-heading" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2
              id="attention-heading"
              className="text-sm font-semibold text-slate-900"
            >
              {t.dashboard.attentionTitle}
            </h2>
            <p className="mt-1 text-[10px] text-slate-500">
              {t.dashboard.attentionSubtitle}
            </p>
          </div>
          <Link
            href="/applications"
            className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-teal-800 hover:text-teal-950"
          >
            {t.dashboard.seeAll}
            <ArrowRight size={13} />
          </Link>
        </div>
        <ApplicationTable attentionOnly />
      </section>

      <section className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <RecentActivity />
        <QuickActions />
      </section>
    </div>
  );
}
