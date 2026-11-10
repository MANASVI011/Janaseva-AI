import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationAiAnalysis } from "./application-ai-analysis";

const api = vi.hoisted(() => ({
  analyzeApplication: vi.fn(),
  getAiProviderStatus: vi.fn(),
}));

vi.mock("@/lib/ai-analysis-api", () => api);
vi.mock("@/components/dashboard/dashboard-provider", () => ({
  useDashboard: () => ({ language: "en" }),
}));

describe("AI analysis demo fallback", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    api.getAiProviderStatus.mockResolvedValue({
      provider: "Groq",
      model: "qwen/qwen3.8-27b",
      status: "UNAVAILABLE",
      reason: "AI_SERVICE_UNAVAILABLE",
    });
    api.analyzeApplication.mockResolvedValue({
      demoFallback: true,
      summary: "No AI analysis was generated.",
      missingInformation: [],
      potentialInconsistencies: [],
      documentObservations: [],
      fieldVerificationObservations: [],
      suggestedQuestions: [],
      officerAttentionPoints: [],
      disclaimer: "Synthetic demonstration only.",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("offers a labeled demo example when AI is unavailable and says findings were not evaluated", async () => {
    render(<ApplicationAiAnalysis applicationId="INC-2026-1208" />);

    const button = await screen.findByRole("button", {
      name: "Show demo example",
    });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await waitFor(() => {
      expect(api.analyzeApplication).toHaveBeenCalledWith(
        "INC-2026-1208",
        "en",
      );
    });
    expect(
      await screen.findByText(
        "Demonstration example only — the AI service was unavailable. No AI analysis was generated, and this example does not assess the application.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Not evaluated in this demonstration example."),
    ).toHaveLength(6);
  });
});
