import { getDemoApiResponse } from "@/lib/demo-api";
import {
  DocumentApiError,
  isDemoModeEnabled,
  requestOfficerApi,
} from "@/lib/document-verification-api";
import type { Language } from "@/lib/dashboard-i18n";

export type AiAnalysis = {
  demoFallback?: true;
  summary: string;
  missingInformation: string[];
  potentialInconsistencies: string[];
  documentObservations: string[];
  fieldVerificationObservations: string[];
  suggestedQuestions: string[];
  officerAttentionPoints: string[];
  disclaimer: string;
};

export type AiProviderStatus = {
  provider: "Groq";
  model: string;
  status: "CONNECTED" | "CONFIGURED" | "NOT_CONFIGURED" | "UNAVAILABLE";
  reason: string | null;
};

export function analyzeApplication(applicationId: string, language: Language) {
  return requestOfficerApi<AiAnalysis>(
    `/applications/${encodeURIComponent(applicationId)}/ai-analysis`,
    { method: "POST", body: JSON.stringify({ language }) },
    "json",
    65_000,
  ).catch((error: unknown) => {
    if (
      isDemoModeEnabled() &&
      error instanceof DocumentApiError &&
      (error.status === 0 || [500, 502, 503, 504].includes(error.status))
    ) {
      const fallback = getDemoApiResponse(
        `/applications/${encodeURIComponent(applicationId)}/ai-analysis`,
        { method: "POST", body: JSON.stringify({ language }) },
      );
      if (fallback !== null) return fallback as AiAnalysis;
    }
    throw error;
  });
}

export function getAiProviderStatus(checkConnectivity = false) {
  const query = checkConnectivity ? "?checkConnectivity=true" : "";
  return requestOfficerApi<AiProviderStatus>(
    `/ai/provider-status${query}`,
    { cache: "no-store" },
    "json",
    65_000,
  );
}
