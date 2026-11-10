import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { messages } from "@/lib/dashboard-i18n";
import { DashboardShell } from "./dashboard-shell";

const route = vi.hoisted(() => ({
  pathname: "/reports",
  replace: vi.fn(),
  authLoading: false,
  officer: null as { id: string; name: string; role: string } | null,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ replace: route.replace }),
}));

vi.mock("@/components/dashboard/dashboard-provider", () => ({
  DashboardProvider: ({ children }: { children: React.ReactNode }) => children,
  useDashboard: () => ({
    authLoading: route.authLoading,
    officer: route.officer,
    t: messages.kn,
    search: "",
    setSearch: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe("dashboard route protection", () => {
  beforeEach(() => {
    route.pathname = "/reports";
    route.authLoading = false;
    route.officer = null;
    route.replace.mockReset();
  });

  it("does not render a protected page for an unauthenticated officer", async () => {
    render(
      <DashboardShell initialLanguage="kn" hasLanguageCookie>
        <p>Protected reports</p>
      </DashboardShell>,
    );
    expect(screen.queryByText("Protected reports")).not.toBeInTheDocument();
    await waitFor(() => expect(route.replace).toHaveBeenCalledWith("/login"));
  });

  it("renders protected content after the officer session is confirmed", () => {
    route.officer = {
      id: "officer-1",
      name: "Officer",
      role: "AUTHORIZED_OFFICER",
    };
    render(
      <DashboardShell initialLanguage="kn" hasLanguageCookie>
        <p>Protected reports</p>
      </DashboardShell>,
    );
    expect(screen.getByText("Protected reports")).toBeInTheDocument();
  });
});
