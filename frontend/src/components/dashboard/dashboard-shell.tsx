"use client";

import { useState, type ReactNode } from "react";
import {
  DashboardProvider,
  useDashboard,
} from "@/components/dashboard/dashboard-provider";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import type { Language } from "@/lib/dashboard-i18n";

export function DashboardShell({
  children,
  initialLanguage,
  hasLanguageCookie,
}: {
  children: ReactNode;
  initialLanguage: Language;
  hasLanguageCookie: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <DashboardProvider
      initialLanguage={initialLanguage}
      hasLanguageCookie={hasLanguageCookie}
    >
      <div className="flex min-h-screen bg-[#f5f7fa]">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((value) => !value)}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        <div className="min-w-0 flex-1">
          <Topbar onMenuClick={() => setMobileOpen(true)} />
          <main className="mx-auto w-full max-w-[1640px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
            {children}
          </main>
          <DashboardFooter />
        </div>
      </div>
    </DashboardProvider>
  );
}

function DashboardFooter() {
  const { t } = useDashboard();
  const year = new Date().getFullYear();

  return (
    <footer className="mx-auto flex max-w-[1640px] flex-wrap items-center justify-between gap-2 px-4 pb-6 text-[10px] text-slate-400 sm:px-6 lg:px-8">
      <span>ಜನಸೇವಾ AI · {year}</span>
      <span>
        © {year} Janaseva AI · {t.dashboard.disclaimer}
      </span>
    </footer>
  );
}
