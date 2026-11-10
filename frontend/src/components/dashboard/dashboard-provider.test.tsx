import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardProvider, useDashboard } from "./dashboard-provider";

const auth = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  loginOfficer: vi.fn(),
  logoutOfficer: vi.fn(),
}));

vi.mock("@/lib/auth-api", () => auth);

function SessionStatus() {
  const { officer } = useDashboard();
  return <p>{officer?.name ?? "Signed out"}</p>;
}

describe("demo session expiry", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    auth.getAuthSession.mockResolvedValue({
      officer: {
        id: "demo-authorized-officer",
        name: "Demonstration Reviewer",
        role: "AUTHORIZED_OFFICER",
      },
      expiresAt: "2026-01-01T00:00:01.000Z",
    });
    auth.logoutOfficer.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("clears the session and signs out an open tab at expiry", async () => {
    render(
      <DashboardProvider initialLanguage="kn" hasLanguageCookie>
        <SessionStatus />
      </DashboardProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("Demonstration Reviewer")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(screen.getByText("Signed out")).toBeInTheDocument();
    expect(auth.logoutOfficer).toHaveBeenCalledOnce();
  });
});
