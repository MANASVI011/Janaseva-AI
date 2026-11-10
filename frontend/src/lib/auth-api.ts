import { isDocumentDemoAuthEnabled } from "@/lib/document-verification-api";

export type AuthenticatedOfficer = {
  id: string;
  name: string;
  role: "CASEWORKER" | "VA_RI" | "AUTHORIZED_OFFICER" | "ADMIN";
};

export type AuthSession = {
  officer: AuthenticatedOfficer;
  expiresAt: string | null;
};

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

export function getAuthSession() {
  return authRequest<AuthSession>("session");
}

export function loginOfficer(username: string, password: string) {
  return authRequest<AuthSession>("login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logoutOfficer() {
  return authRequest<{ success: boolean }>("logout", { method: "POST" });
}
