import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { Language } from "@/lib/dashboard-i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "ಜನಸೇವಾ AI | Janaseva AI",
  description:
    "ಕರ್ನಾಟಕದಲ್ಲಿ ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ ಅರ್ಜಿಗಳ ನಿರ್ವಹಣೆಗೆ ಸಹಾಯಕವಾದ ಪ್ರದರ್ಶನ ವೇದಿಕೆ.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const languageCookie = cookieStore.get("janaseva-language")?.value;
  const initialLanguage: Language = languageCookie === "en" ? "en" : "kn";
  const hasLanguageCookie = languageCookie === "en" || languageCookie === "kn";

  return (
    <html lang={initialLanguage} className="h-full antialiased">
      <body className="min-h-full font-sans">
        <DashboardShell
          initialLanguage={initialLanguage}
          hasLanguageCookie={hasLanguageCookie}
        >
          {children}
        </DashboardShell>
      </body>
    </html>
  );
}
