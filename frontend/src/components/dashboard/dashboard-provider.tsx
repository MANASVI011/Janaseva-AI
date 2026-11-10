"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { messages, type Language } from "@/lib/dashboard-i18n";
import {
  applications,
  createInitialApplicationCase,
  type ApplicationCase,
} from "@/lib/demo-data";

type DashboardContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (typeof messages)[Language];
  search: string;
  setSearch: (search: string) => void;
  cases: Record<string, ApplicationCase>;
  updateCase: (
    id: string,
    update: (applicationCase: ApplicationCase) => ApplicationCase,
  ) => void;
  documentApiToken: string;
  setDocumentApiToken: (token: string) => void;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({
  children,
  initialLanguage,
  hasLanguageCookie,
}: {
  children: ReactNode;
  initialLanguage: Language;
  hasLanguageCookie: boolean;
}) {
  const [language, setLanguageState] = useState(initialLanguage);
  const [search, setSearch] = useState("");
  const [documentApiToken, setDocumentApiToken] = useState("");
  const [cases, setCases] = useState<Record<string, ApplicationCase>>(() =>
    Object.fromEntries(
      applications.map((application) => [
        application.id,
        createInitialApplicationCase(application),
      ]),
    ),
  );
  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem("janaseva-language", nextLanguage);
    document.cookie = `janaseva-language=${nextLanguage}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (hasLanguageCookie) return;
    const savedLanguage = window.localStorage.getItem("janaseva-language");
    if (savedLanguage !== "kn" && savedLanguage !== "en") return;
    const timer = window.setTimeout(() => setLanguage(savedLanguage), 0);
    return () => window.clearTimeout(timer);
  }, [hasLanguageCookie, setLanguage]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "janaseva-language" || event.key === null) {
        const savedLanguage = window.localStorage.getItem("janaseva-language");
        if (savedLanguage === "kn" || savedLanguage === "en") {
          setLanguage(savedLanguage);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [setLanguage]);
  const updateCase = useCallback(
    (
      id: string,
      update: (applicationCase: ApplicationCase) => ApplicationCase,
    ) => {
      setCases((current) => {
        const applicationCase = current[id];
        if (!applicationCase) {
          throw new Error(`Unknown demonstration application: ${id}`);
        }
        return { ...current, [id]: update(applicationCase) };
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: messages[language],
      search,
      setSearch,
      cases,
      updateCase,
      documentApiToken,
      setDocumentApiToken,
    }),
    [cases, documentApiToken, language, search, setLanguage, updateCase],
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within DashboardProvider.");
  }
  return context;
}
