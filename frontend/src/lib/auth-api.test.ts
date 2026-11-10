import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthSession, loginOfficer, logoutOfficer } from "@/lib/auth-api";
import {
  getApplicationDocuments,
  getApplications,
  requestOfficerApi,
  getVerificationQueue,
} from "@/lib/document-verification-api";
import {
  getFieldApplication,
  getFieldQueue,
} from "@/lib/field-verification-api";
import { getFinalReviewQueue } from "@/lib/final-review-api";
import { getDashboardHistory, getDashboardReport } from "@/lib/operations-api";
import { analyzeApplication } from "@/lib/ai-analysis-api";

describe("demo authentication", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ accepted: true }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([
    ["arbitrary", "credentials"],
    ["A", "1"],
    ["B", "2"],
    ["C", "3"],
    ["D", "3"],
  ])(
    "creates a persistent demo session for non-empty credentials",
    async (username, password) => {
      const session = await loginOfficer(username, password);

      expect(session.officer).toMatchObject({
        id: "demo-authorized-officer",
        role: "AUTHORIZED_OFFICER",
      });
      await expect(getAuthSession()).resolves.toEqual(session);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("rejects empty credentials and clears the demo session on logout", async () => {
    await expect(loginOfficer("  ", "password")).rejects.toThrow(
      "unauthorized",
    );
    await expect(loginOfficer("name", "")).rejects.toThrow("unauthorized");

    await loginOfficer("any-name", "any-password");
    await expect(logoutOfficer()).resolves.toEqual({ success: true });
    expect(window.localStorage.length).toBe(0);
    await expect(getAuthSession()).resolves.toMatchObject({
      officer: { id: "demo-authorized-officer" },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("creates a persistent demo session automatically for direct dashboard access", async () => {
    const session = await getAuthSession();
    expect(session.officer).toMatchObject({
      id: "demo-authorized-officer",
      role: "AUTHORIZED_OFFICER",
    });
    expect(await getAuthSession()).toEqual(session);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("adds the explicit demo header to dashboard API operations", async () => {
    await expect(requestOfficerApi("/reports")).resolves.toEqual({
      accepted: true,
    });

    const [requestUrl, requestInit] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(requestUrl).toBe("/api/reports");
    const requestHeaders = requestInit?.headers;
    expect(new Headers(requestHeaders).get("X-Janaseva-Demo-Auth")).toBe(
      "enabled",
    );
  });

  it("adds the explicit demo header to field-verification API operations", async () => {
    await expect(
      getFieldQueue(new URLSearchParams("status=pending")),
    ).resolves.toEqual({ accepted: true });

    const [requestUrl, requestInit] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(requestUrl).toBe("/api/field-verification?status=pending");
    expect(new Headers(requestInit?.headers).get("X-Janaseva-Demo-Auth")).toBe(
      "enabled",
    );
  });

  it("uses synthetic application data when the backend returns a server error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: "Backend unavailable" }),
      }),
    );

    const result = await getApplications(new URLSearchParams());
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]).toMatchObject({
      id: "INC-2026-1208",
      applicantName: "Nandini Gowda",
      serviceType: "Income Certificate",
    });
  });

  it("uses synthetic field cases when the backend cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await getFieldQueue(new URLSearchParams());
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]).toMatchObject({
      applicationId: "INC-2026-1203",
      workflowStage: "FIELD_VERIFICATION",
    });
  });

  it("serves synthetic queues, application details, reports, and history offline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: "Backend unavailable" }),
      }),
    );

    const [documents, documentQueue, fieldDetail, finalQueue, report, history] =
      await Promise.all([
        getApplicationDocuments("INC-2026-1208"),
        getVerificationQueue(new URLSearchParams()),
        getFieldApplication("INC-2026-1203"),
        getFinalReviewQueue(""),
        getDashboardReport(
          {
            fromDate: "",
            toDate: "",
            status: "",
            workflowStage: "",
            officerId: "",
            serviceType: "",
            search: "",
          },
          1,
          10,
        ),
        getDashboardHistory(
          {
            fromDate: "",
            toDate: "",
            status: "",
            workflowStage: "",
            officerId: "",
            serviceType: "",
            search: "",
          },
          1,
          10,
        ),
      ]);

    expect(documents.documents.length).toBeGreaterThan(0);
    expect(documentQueue.items.length).toBeGreaterThan(0);
    expect(fieldDetail.application.id).toBe("INC-2026-1203");
    expect(finalQueue.items.length).toBeGreaterThan(0);
    expect(report.summary.totalApplications).toBeGreaterThan(0);
    expect(history.items.length).toBeGreaterThan(0);
  });

  it("reports unavailable rather than mislabeling the Groq key as missing offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(
      requestOfficerApi("/ai/provider-status"),
    ).resolves.toMatchObject({
      provider: "Groq",
      status: "UNAVAILABLE",
      reason: "AI analysis is unavailable in offline demonstration mode.",
    });
  });

  it("does not replace an unavailable AI service with synthetic analysis", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: "Internal server error" }),
      }),
    );

    await expect(
      analyzeApplication("INC-2026-1208", "en"),
    ).rejects.toMatchObject({ status: 500 });
  });

  it("does not replace authentication failures with a synthetic AI fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Unauthorized" }),
      }),
    );

    await expect(
      analyzeApplication("INC-2026-1208", "en"),
    ).rejects.toMatchObject({ status: 401 });
  });
});
