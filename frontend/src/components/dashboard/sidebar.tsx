"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesColumnIncreasing,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileClock,
  FileCheck2,
  FileText,
  LayoutDashboard,
  MapPinned,
  Settings,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { sectionLabels } from "@/lib/dashboard-i18n";

const navigation: {
  href: string;
  key: keyof ReturnType<typeof useDashboard>["t"]["nav"];
  icon: LucideIcon;
}[] = [
  { href: "/", key: "dashboard", icon: LayoutDashboard },
  { href: "/applications", key: "applications", icon: FileText },
  {
    href: "/document-verification",
    key: "documents",
    icon: ClipboardCheck,
  },
  { href: "/field-verification", key: "field", icon: MapPinned },
  { href: "/final-review", key: "finalReview", icon: FileCheck2 },
  { href: "/reports", key: "reports", icon: ChartNoAxesColumnIncreasing },
  { href: "/history", key: "history", icon: FileClock },
  { href: "/settings", key: "settings", icon: Settings },
];

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onClose: () => void;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onClose,
}: SidebarProps) {
  const { t, officer, language } = useDashboard();
  const pathname = usePathname();
  const officerRoleLabel =
    language === "kn"
      ? {
          CASEWORKER: "ಪ್ರಕರಣ ಕಾರ್ಯಕರ್ತ",
          VA_RI: "ಗ್ರಾಮ ಲೆಕ್ಕಾಧಿಕಾರಿ / ಕಂದಾಯ ನಿರೀಕ್ಷಕ",
          AUTHORIZED_OFFICER: "ಅಧಿಕೃತ ಪರಿಶೀಲನಾ ಅಧಿಕಾರಿ",
          ADMIN: "ನಿರ್ವಾಹಕರು",
        }[officer?.role ?? "CASEWORKER"]
      : {
          CASEWORKER: "Caseworker",
          VA_RI: "Village Accountant / Revenue Inspector",
          AUTHORIZED_OFFICER: "Authorized Officer",
          ADMIN: "Administrator",
        }[officer?.role ?? "CASEWORKER"];

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label={t.nav.closeNavigation}
          className="fixed inset-0 z-40 cursor-default bg-slate-950/45 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-[#101f35] text-slate-100 shadow-xl transition-[transform,width] duration-200 lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:shrink-0 lg:translate-x-0 lg:shadow-none ${
          collapsed ? "lg:w-[82px]" : "lg:w-[264px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-5">
          <Link
            href="/"
            className={`flex min-w-0 items-center gap-3 ${collapsed ? "lg:mx-auto" : ""}`}
            onClick={onClose}
            aria-label="ಜನಸೇವಾ AI"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-400 text-[#10233d]">
              <ShieldCheck size={23} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span className={collapsed ? "lg:hidden" : ""}>
              <span className="block text-[15px] font-semibold tracking-tight text-white">
                ಜನಸೇವಾ AI
              </span>
              <span className="mt-0.5 block text-[10px] font-medium tracking-[0.16em] text-slate-400">
                JANASEVA AI
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label={t.nav.closeNavigation}
            onClick={onClose}
          >
            <X size={18} />
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white lg:flex"
            aria-label={collapsed ? t.nav.expand : t.nav.collapse}
            title={collapsed ? t.nav.expand : t.nav.collapse}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>

        <div className={`px-5 pb-2 pt-7 ${collapsed ? "lg:px-3" : ""}`}>
          <p
            className={`px-2 text-[10px] font-semibold tracking-[0.17em] text-slate-500 ${
              collapsed ? "lg:hidden" : ""
            }`}
          >
            {t.nav.workspace}
          </p>
        </div>

        <nav
          aria-label={t.nav.workspace}
          className={`flex-1 space-y-1 px-3 ${collapsed ? "lg:px-3" : ""}`}
        >
          {navigation.map(({ href, key, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? t.nav[key] : undefined}
                onClick={onClose}
                className={`group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-teal-400/15 text-teal-200"
                    : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
                } ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
              >
                {active && (
                  <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-teal-300" />
                )}
                <Icon
                  size={18}
                  strokeWidth={active ? 2.2 : 1.8}
                  className="shrink-0"
                  aria-hidden="true"
                />
                <span className={collapsed ? "lg:hidden" : ""}>
                  {t.nav[key]}
                </span>
                {collapsed && (
                  <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100 lg:block">
                    {t.nav[key]}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div
            className={`flex items-center gap-3 rounded-xl bg-white/[0.06] p-3 ${
              collapsed ? "lg:justify-center lg:px-1.5" : ""
            }`}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#dbe8f3] text-xs font-semibold text-[#213954]">
              {officer?.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toLocaleUpperCase())
                .join("") ?? "AI"}
            </span>
            <span className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
              <span className="block truncate text-xs font-semibold text-white">
                {officer?.name}
              </span>
              <span className="mt-0.5 block text-[11px] text-slate-400">
                {officerRoleLabel}
              </span>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}

export function getSectionKey(pathname: string) {
  const path = pathname.split("/")[1];
  return path ? sectionLabels[path] : undefined;
}
