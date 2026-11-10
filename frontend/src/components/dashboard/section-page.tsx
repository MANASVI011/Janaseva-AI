"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  FileClock,
  FileCheck2,
  FileText,
  MapPinned,
  Settings,
} from "lucide-react";
import { ApplicationTable } from "@/components/dashboard/application-table";
import { DocumentVerificationPage } from "@/components/dashboard/document-verification-page";
import { FieldVerificationPage } from "@/components/dashboard/field-verification-page";
import { FinalReviewPage } from "@/components/dashboard/final-review-page";
import { HistoryPage } from "@/components/dashboard/history-page";
import { ReportsPage } from "@/components/dashboard/reports-page";
import { SettingsPage } from "@/components/dashboard/settings-page";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { sectionLabels } from "@/lib/dashboard-i18n";
import type { ApplicationStatus } from "@/lib/dashboard-i18n";

type SectionPageProps = {
  section: string;
  initialStatus: "all" | ApplicationStatus;
};

const sectionIcons = {
  applications: FileText,
  "document-verification": ClipboardCheck,
  "field-verification": MapPinned,
  "final-review": FileCheck2,
  reports: FileText,
  history: FileClock,
  settings: Settings,
};

export function SectionPage({ section, initialStatus }: SectionPageProps) {
  const { t } = useDashboard();
  const sectionKey = sectionLabels[section];
  if (!sectionKey) return null;

  const title = t.nav[sectionKey];
  if (section === "applications") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-teal-800">
              {t.dashboard.eyebrow}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {t.dashboard.attentionSubtitle}
            </p>
          </div>
          <span className="w-fit rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-700">
            {t.table.dataSource}
          </span>
        </div>
        <ApplicationTable key={initialStatus} initialStatus={initialStatus} />
      </div>
    );
  }

  if (section === "document-verification") {
    return <DocumentVerificationPage />;
  }
  if (section === "field-verification") {
    return <FieldVerificationPage />;
  }
  if (section === "final-review") return <FinalReviewPage />;
  if (section === "reports") return <ReportsPage />;
  if (section === "history") return <HistoryPage />;
  if (section === "settings") return <SettingsPage />;

  const Icon = sectionIcons[section as keyof typeof sectionIcons];
  return (
    <section className="mx-auto flex min-h-[min(70vh,680px)] max-w-3xl flex-col justify-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-10">
        <div className="flex size-12 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
          <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.15em] text-teal-800">
          {t.placeholder.eyebrow} · {t.placeholder.demo}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
          {t.placeholder.coming}
        </p>
        <p className="mt-2 max-w-xl text-xs leading-6 text-slate-500">
          {t.placeholder.description}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#12243d] px-4 text-xs font-medium text-white transition hover:bg-[#1b3555]"
          >
            <ArrowLeft size={15} />
            {t.placeholder.back}
          </Link>
          <Link
            href="/applications"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {t.nav.applications}
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}
