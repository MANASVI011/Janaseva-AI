import {
  isDemoModeEnabled,
  isDocumentDemoAuthEnabled,
} from "@/lib/document-verification-api";

export type AuthenticatedOfficer = {
  id: string;
  name: string;
  role: "CASEWORKER" | "VA_RI" | "AUTHORIZED_OFFICER" | "ADMIN";
};

export type AuthSession = {
  officer: AuthenticatedOfficer;
  expiresAt: string | null;
};

const demoSessionStorageKey = "janaseva-demo-session";
const demoSessionLifetimeMs = 8 * 60 * 60 * 1000;

async function authRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (isDocumentDemoAuthEnabled()) {
    headers.set("X-Janaseva-Demo-Auth", "enabled");
  }
  const response = await fetch(`/api/auth/${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(response.status === 401 ? "unauthorized" : "request");
  }
  return (await response.json()) as T;
}

function readDemoSession(): AuthSession | null {
  const stored = window.localStorage.getItem(demoSessionStorageKey);
  if (!stored) return null;

  try {
    const session = JSON.parse(stored) as AuthSession;
    if (
      session.officer?.id === "demo-authorized-officer" &&
      session.officer.role === "AUTHORIZED_OFFICER" &&
      typeof session.officer.name === "string" &&
      typeof session.expiresAt === "string" &&
      Date.parse(session.expiresAt) > Date.now()
    ) {
      return session;
    }
  } catch {
    // Invalid browser state is cleared below.
  }

  window.localStorage.removeItem(demoSessionStorageKey);
  return null;
}

export function getAuthSession() {
  if (isDemoModeEnabled()) {
    const session = readDemoSession();
    return session
      ? Promise.resolve(session)
      : Promise.reject(new Error("unauthorized"));
  }
  return authRequest<AuthSession>("session");
}

export function loginOfficer(username: string, password: string) {
  if (isDemoModeEnabled()) {
    if (!username.trim() || !password) {
      return Promise.reject(new Error("unauthorized"));
    }
    const session: AuthSession = {
      officer: {
        id: "demo-authorized-officer",
        name: "Demonstration Reviewer",
        role: "AUTHORIZED_OFFICER",
      },
      expiresAt: new Date(Date.now() + demoSessionLifetimeMs).toISOString(),
    };
    window.localStorage.setItem(demoSessionStorageKey, JSON.stringify(session));
    return Promise.resolve(session);
  }
  return authRequest<AuthSession>("login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logoutOfficer() {
  if (isDemoModeEnabled()) {
    window.localStorage.removeItem(demoSessionStorageKey);
    return Promise.resolve({ success: true });
  }
  return authRequest<{ success: boolean }>("logout", { method: "POST" });
}
