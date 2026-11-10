"use client";

import { useState, type ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import {
  DashboardProvider,
  useDashboard,
} from "@/components/dashboard/dashboard-provider";
import { LoginPage } from "@/components/dashboard/login-page";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import type { Language } from "@/lib/dashboard-i18n";
import { isDemoModeEnabled } from "@/lib/document-verification-api";

export function DashboardShell({
  children,
  initialLanguage,
  hasLanguageCookie,
}: {
  children: ReactNode;
  initialLanguage: Language;
  hasLanguageCookie: boolean;
}) {
  return (
    <DashboardProvider
      initialLanguage={initialLanguage}
      hasLanguageCookie={hasLanguageCookie}
    >
      <DashboardFrame>{children}</DashboardFrame>
    </DashboardProvider>
  );
}

function DashboardFrame({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { authLoading, officer, language, t } = useDashboard();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (authLoading) return;
    if (isLoginPage && officer) router.replace("/");
    else if (!isLoginPage && !officer) router.replace("/login");
  }, [authLoading, isLoginPage, officer, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa]">
        <div
          className="flex items-center gap-3 text-sm text-slate-600"
          role="status"
        >
          <ShieldCheck className="animate-pulse text-teal-700" size={22} />
          ಜನಸೇವಾ AI
        </div>
      </div>
    );
  }
  if (isLoginPage) return <LoginPage />;
  if (!officer) return null;

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="min-w-0 flex-1">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        {isDemoModeEnabled() && (
          <div
            className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900 sm:px-6 lg:px-8"
            role="status"
            lang={language}
          >
            {t.demoModeNotice}
          </div>
        )}
        <main className="mx-auto w-full max-w-[1640px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          {children}
        </main>
        <DashboardFooter />
      </div>
    </div>
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
