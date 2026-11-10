"use client";

import { useState, type FormEvent } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { LanguageSwitcher } from "@/components/dashboard/language-switcher";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { isDemoModeEnabled } from "@/lib/document-verification-api";

const copy = {
  kn: {
    eyebrow: "ಅಧಿಕಾರಿ ಸುರಕ್ಷಿತ ಪ್ರವೇಶ",
    demoEyebrow: "ಪ್ರದರ್ಶನ ಪ್ರವೇಶ",
    title: "ಜನಸೇವಾ AI ಗೆ ಸ್ವಾಗತ",
    description: "ನಿಮ್ಮ ಅಧಿಕೃತ ಅಧಿಕಾರಿಯ ಖಾತೆಯ ಮೂಲಕ ಮುಂದುವರಿಯಿರಿ.",
    demoDescription:
      "ಪ್ರದರ್ಶನ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ತೆರೆಯಲು ಯಾವುದೇ ವಿವರಗಳನ್ನು ನಮೂದಿಸಿ.",
    username: "ಬಳಕೆದಾರ ಹೆಸರು",
    password: "ಪಾಸ್‌ವರ್ಡ್",
    submit: "ಸುರಕ್ಷಿತವಾಗಿ ಪ್ರವೇಶಿಸಿ",
    demoSubmit: "ಪ್ರದರ್ಶನಕ್ಕೆ ಮುಂದುವರಿಯಿರಿ",
    submitting: "ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…",
    required: "ಬಳಕೆದಾರ ಹೆಸರು ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ.",
    invalid: "ಲಾಗಿನ್ ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    security: "ನಿಮ್ಮ ಅಧಿವೇಶನ ಸುರಕ್ಷಿತವಾಗಿ ನಿರ್ವಹಿಸಲಾಗುತ್ತದೆ.",
    demoSecurity:
      "ಪ್ರದರ್ಶನ ಪ್ರವೇಶ ಮಾತ್ರ: ಯಾವುದೇ ಹೆಸರು ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ಸ್ವೀಕರಿಸಲಾಗುತ್ತದೆ; ಇದು ಸುರಕ್ಷಿತ ದೃಢೀಕರಣವಲ್ಲ.",
    notice: "ಇದು ಪ್ರದರ್ಶನ ಅಪ್ಲಿಕೇಶನ್; ಕರ್ನಾಟಕ ಸರ್ಕಾರದ ಅಧಿಕೃತ ಪೋರ್ಟಲ್ ಅಲ್ಲ.",
  },
  en: {
    eyebrow: "SECURE OFFICER ACCESS",
    demoEyebrow: "DEMONSTRATION ACCESS",
    title: "Welcome to Janaseva AI",
    description: "Continue with your authorized officer account.",
    demoDescription: "Enter any details to open the demonstration dashboard.",
    username: "Username",
    password: "Password",
    submit: "Sign in securely",
    demoSubmit: "Continue to demo",
    submitting: "Signing in…",
    required: "Enter your username and password.",
    invalid: "Sign-in failed. Check your details and try again.",
    security: "Your session is managed securely.",
    demoSecurity:
      "Demo access only: any username and password work; this is not secure authentication.",
    notice:
      "Demonstration application only; not an official Karnataka government portal.",
  },
} as const;

export function LoginPage() {
  const { language, login } = useDashboard();
  const words = copy[language];
  const demoMode = isDemoModeEnabled();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError(words.required);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
    } catch {
      setError(words.invalid);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f7fa] px-4 py-10">
      <div className="absolute right-5 top-5">
        <LanguageSwitcher />
      </div>
      <div className="pointer-events-none absolute -left-28 -top-32 size-96 rounded-full bg-teal-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 -right-20 size-96 rounded-full bg-blue-100/70 blur-3xl" />
      <section className="relative w-full max-w-[440px] rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_24px_70px_-34px_rgba(15,35,60,0.28)] sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-[#10233d] text-teal-300">
            <ShieldCheck size={27} strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight text-slate-900">
              ಜನಸೇವಾ AI
            </p>
            <p className="text-[10px] font-medium tracking-[0.18em] text-slate-500">
              JANASEVA AI
            </p>
          </div>
        </div>

        <p className="text-[10px] font-semibold tracking-[0.17em] text-teal-800">
          {demoMode ? words.demoEyebrow : words.eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {words.title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {demoMode ? words.demoDescription : words.description}
        </p>

        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              {words.username}
            </span>
            <input
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              {words.password}
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            />
          </label>
          {error && (
            <p
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-800"
              role="alert"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#12243d] px-4 text-sm font-medium text-white transition hover:bg-[#1b3555] disabled:cursor-wait disabled:opacity-65"
          >
            <LockKeyhole size={15} aria-hidden="true" />
            {submitting
              ? words.submitting
              : demoMode
                ? words.demoSubmit
                : words.submit}
          </button>
        </form>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck size={14} className="text-teal-700" aria-hidden="true" />
          {demoMode ? words.demoSecurity : words.security}
        </p>
        <p className="mt-6 border-t border-slate-100 pt-4 text-center text-[10px] leading-5 text-slate-500">
          {words.notice}
        </p>
      </section>
    </main>
  );
}
