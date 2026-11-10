"use client";

import { Languages } from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useDashboard();

  return (
    <div
      role="group"
      aria-label={t.topbar.language}
      className="flex h-9 items-center rounded-lg border border-slate-200 bg-white p-1"
    >
      <Languages size={15} className="ml-1.5 mr-1 text-slate-500" aria-hidden />
      <button
        type="button"
        onClick={() => setLanguage("kn")}
        aria-pressed={language === "kn"}
        className={`h-7 rounded-md px-2 text-xs font-medium transition ${
          language === "kn"
            ? "bg-[#edf4f5] text-[#0b6970]"
            : "text-slate-500 hover:text-slate-900"
        }`}
      >
        ಕನ್ನಡ
      </button>
      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        className={`h-7 rounded-md px-2 text-xs font-medium transition ${
          language === "en"
            ? "bg-[#edf4f5] text-[#0b6970]"
            : "text-slate-500 hover:text-slate-900"
        }`}
      >
        EN
      </button>
    </div>
  );
}
