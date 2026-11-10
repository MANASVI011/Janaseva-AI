import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentApiError } from "@/lib/document-verification-api";
import { ApplicationAiAnalysis } from "./application-ai-analysis";

const api = vi.hoisted(() => ({
  analyzeApplication: vi.fn(),
  getAiProviderStatus: vi.fn(),
}));

vi.mock("@/lib/ai-analysis-api", () => api);
vi.mock("@/components/dashboard/dashboard-provider", () => ({
  useDashboard: () => ({ language: "en" }),
}));

describe("AI application analysis", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    api.getAiProviderStatus.mockResolvedValue({
      provider: "Groq",
      model: "qwen/qwen3.8-27b",
      status: "UNAVAILABLE",
      reason: "AI_SERVICE_UNAVAILABLE",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("allows a real analysis request when provider status is unavailable and shows the HTTP failure", async () => {
    api.analyzeApplication.mockRejectedValue(
      new DocumentApiError("request", 500),
    );
    render(<ApplicationAiAnalysis applicationId="INC-2026-1208" />);

    const button = await screen.findByRole("button", {
      name: "Analyze Application with AI",
    });
    expect(button).toBeEnabled();
    expect(
      await screen.findByText("The AI service is unavailable. Please retry."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/demonstration example/i),
    ).not.toBeInTheDocument();
    fireEvent.click(button);
    await waitFor(() => {
      expect(api.analyzeApplication).toHaveBeenCalledWith(
        "INC-2026-1208",
        "en",
      );
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "AI request failed (HTTP 500).",
    );
  });
});
