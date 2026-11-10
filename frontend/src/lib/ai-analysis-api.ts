import { requestOfficerApi } from "@/lib/document-verification-api";
import type { Language } from "@/lib/dashboard-i18n";

export type AiAnalysis = {
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

export function analyzeApplication(
  token: string,
  applicationId: string,
  language: Language,
) {
  return requestOfficerApi<AiAnalysis>(
    token,
    `/applications/${encodeURIComponent(applicationId)}/ai-analysis`,
    { method: "POST", body: JSON.stringify({ language }) },
    "json",
    65_000,
  );
}

export function getAiProviderStatus(token: string, checkConnectivity = false) {
  const query = checkConnectivity ? "?checkConnectivity=true" : "";
  return requestOfficerApi<AiProviderStatus>(
    token,
    `/ai/provider-status${query}`,
    { cache: "no-store" },
    "json",
    65_000,
  );
}
