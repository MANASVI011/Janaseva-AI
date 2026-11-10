import { render, screen } from "@testing-library/react";
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

  it("does not offer or render synthetic analysis when the AI service is unavailable", async () => {
    render(<ApplicationAiAnalysis applicationId="INC-2026-1208" />);

    const button = await screen.findByRole("button", {
      name: "Analyze Application with AI",
    });
    expect(button).toBeDisabled();
    expect(
      screen.getByText("The AI service is unavailable. Please retry."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/demonstration example/i),
    ).not.toBeInTheDocument();
    expect(api.analyzeApplication).not.toHaveBeenCalled();
  });
});
