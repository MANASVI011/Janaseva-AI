"use client";

import { useEffect, useState, type ReactNode } from "react";
import { UserRound } from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import {
  getOfficerProfile,
  getOperationsErrorMessage,
  type OfficerProfile,
} from "@/lib/operations-api";
import { getOperationsWords } from "@/lib/operations-i18n";

export function SettingsPage() {
  const { language, documentApiToken } = useDashboard();
  const words = getOperationsWords(language);
  const [profile, setProfile] = useState<OfficerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [profileReload, setProfileReload] = useState(0);

  useEffect(() => {
    let active = true;
    getOfficerProfile(documentApiToken)
      .then((result) => {
        if (active) {
          setProfile(result);
          setProfileError("");
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setProfileError(getOperationsErrorMessage(cause, words.loadError));
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [documentApiToken, profileReload, words.loadError]);

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-teal-800">
          {words.databaseRecords}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          {words.settingsTitle}
        </h2>
        <p className="mt-1 text-xs text-slate-500">{words.settingsSubtitle}</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <SectionHeading icon={<UserRound size={17} />} title={words.profile} />
        {profileLoading ? (
          <p className="mt-4 text-xs text-slate-500" role="status">
            {words.loading}
          </p>
        ) : profileError ? (
          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
            role="alert"
          >
            {profileError}
            <button
              type="button"
              onClick={() => {
                setProfileLoading(true);
                setProfileReload((current) => current + 1);
              }}
              className="rounded border border-rose-200 bg-white px-2 py-1 font-medium"
            >
              {words.retry}
            </button>
          </div>
        ) : profile ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileItem
              label={words.accountName}
              value={profile.officer.name}
            />
            <ProfileItem
              label={words.accountRole}
              value={formatRole(profile.officer.role, language)}
            />
            <ProfileItem label={words.accountId} value={profile.officer.id} />
            <ProfileItem
              label={words.accountStatus}
              value={words.active}
              badge
            />
            <ProfileItem
              label={words.authentication}
              value={
                profile.account.authentication === "DEMONSTRATION"
                  ? words.demoAccount
                  : words.signedSession
              }
            />
            <ProfileItem
              label={words.department}
              value={profile.organization.department ?? words.notAvailable}
            />
            <ProfileItem
              label={words.district}
              value={profile.organization.district ?? words.notAvailable}
            />
          </dl>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-semibold text-slate-900">
          {words.applicationInfo}
        </h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <ProfileItem
            label={words.applicationInfo}
            value={profile?.application.name ?? "Janaseva AI"}
          />
          <ProfileItem
            label={words.version}
            value={profile?.application.version ?? words.notAvailable}
          />
          <div className="sm:col-span-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-900">
            {words.officialNotice}
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-semibold text-slate-900">
          {words.aiProviderTitle}
        </h3>
        <p className="mt-2 text-xs text-slate-700">Groq</p>
      </section>
    </div>
  );
}

function SectionHeading({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
      <span className="text-teal-800">{icon}</span>
      {title}
    </h3>
  );
}

function ProfileItem({
  label,
  value,
  badge = false,
}: {
  label: string;
  value: string;
  badge?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-medium text-slate-500">{label}</dt>
      <dd
        className={`mt-1 break-words text-xs ${
          badge
            ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-medium text-emerald-800"
            : "text-slate-800"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function formatRole(role: string, language: "kn" | "en") {
  const roles: Record<string, { kn: string; en: string }> = {
    CASEWORKER: { kn: "ಪ್ರಕರಣ ಕಾರ್ಯಕರ್ತೆ", en: "Caseworker" },
    VA_RI: { kn: "ಗ್ರಾಮ ಆಡಳಿತಾಧಿಕಾರಿ / ಕಂದಾಯ ನಿರೀಕ್ಷಕ", en: "VA / RI" },
    AUTHORIZED_OFFICER: { kn: "ಅಧಿಕೃತ ಅಧಿಕಾರಿ", en: "Authorized officer" },
    ADMIN: { kn: "ನಿರ್ವಾಹಕರು", en: "Administrator" },
  };
  return roles[role]?.[language] ?? role;
}
