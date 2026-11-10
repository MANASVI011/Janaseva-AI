"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  FileCheck2,
  LogOut,
  Menu,
  Search,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/dashboard/language-switcher";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { getSectionKey } from "@/components/dashboard/sidebar";
import { getApplications } from "@/lib/document-verification-api";

type TopbarProps = {
  onMenuClick: () => void;
};

export function Topbar({ onMenuClick }: TopbarProps) {
  const { search, setSearch, t, officer, logout } = useDashboard();
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; applicantName: string }>
  >([]);
  const sectionKey = getSectionKey(pathname);
  const isApplicationDetail =
    pathname.startsWith("/applications/") && pathname !== "/applications/";
  const pageTitle = isApplicationDetail
    ? t.applicationDetail.pageTitle
    : sectionKey
      ? t.nav[sectionKey]
      : t.nav.dashboard;

  const query = search.trim();
  const results = query.length >= 2 ? searchResults : [];
  const initials =
    officer?.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase())
      .join("") ?? "AI";

  useEffect(() => {
    if (query.length < 2) return;

    let active = true;
    const parameters = new URLSearchParams({
      page: "1",
      pageSize: "4",
      search: query,
    });

    getApplications(parameters)
      .then((result) => {
        if (!active) return;
        setSearchResults(
          result.items.map((application) => ({
            id: application.id,
            applicantName: application.applicantName,
          })),
        );
      })
      .catch(() => {
        if (active) setSearchResults([]);
      });

    return () => {
      active = false;
    };
  }, [query]);

  function openSearchResult() {
    router.push("/applications");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="flex min-h-[72px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:flex-nowrap lg:px-8">
        <button
          type="button"
          aria-label={t.nav.openNavigation}
          onClick={onMenuClick}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 lg:hidden"
        >
          <Menu size={19} />
        </button>

        <div className="min-w-0 flex-1 lg:flex-none">
          <div className="hidden items-center gap-2 text-[11px] text-slate-400 sm:flex">
            <span>{t.topbar.breadcrumb}</span>
            {pathname !== "/" && <span aria-hidden="true">/</span>}
            {pathname !== "/" && (
              <span className="text-slate-500">{pageTitle}</span>
            )}
          </div>
          <h1 className="truncate text-base font-semibold text-slate-900 sm:mt-1 sm:text-[17px]">
            {pageTitle}
          </h1>
        </div>

        <div className="relative order-3 w-full flex-none lg:order-none lg:ml-auto lg:w-[min(34vw,380px)]">
          <label className="sr-only" htmlFor="global-application-search">
            {t.topbar.searchLabel}
          </label>
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="global-application-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && search.trim()) openSearchResult();
              if (event.key === "Escape") setSearch("");
            }}
            placeholder={t.topbar.search}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-9 pr-9 text-[12px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/10"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label={t.topbar.clearSearch}
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
            >
              <X size={15} />
            </button>
          )}
          {results.length > 0 && (
            <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
              {results.map((application) => (
                <button
                  type="button"
                  key={application.id}
                  onClick={() => router.push(`/applications/${application.id}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-slate-800">
                      {application.applicantName}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-400">
                      {application.id}
                    </span>
                  </span>
                  <FileCheck2 size={16} className="shrink-0 text-teal-700" />
                </button>
              ))}
            </div>
          )}
          {query.length > 1 && results.length === 0 && (
            <div className="absolute left-0 right-0 top-12 z-50 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-xl">
              {t.table.noResults}
            </div>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          <LanguageSwitcher />
          <div className="relative">
            <button
              type="button"
              aria-label={t.topbar.profile}
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((open) => !open)}
              className="flex size-9 items-center justify-center rounded-full bg-[#dbe8f3] text-[11px] font-semibold text-[#213954] ring-2 ring-white transition hover:ring-slate-200"
            >
              {initials}
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-900">
                    {officer?.name}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {officer?.role.replaceAll("_", " ")}
                  </p>
                </div>
                {logoutError && (
                  <p
                    className="px-4 py-2 text-[11px] text-rose-700"
                    role="alert"
                  >
                    {t.profile.signOutError}
                  </p>
                )}
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  <UserRound size={15} /> {t.profile.account}
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  <Settings size={15} /> {t.profile.settings}
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    setLogoutError(false);
                    try {
                      await logout();
                      router.replace("/login");
                    } catch {
                      setLogoutError(true);
                    }
                    setProfileOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  <LogOut size={15} /> {t.profile.signOut}
                </button>
              </div>
            )}
          </div>
          <ChevronDown size={14} className="hidden text-slate-400 sm:block" />
        </div>
      </div>
    </header>
  );
}
