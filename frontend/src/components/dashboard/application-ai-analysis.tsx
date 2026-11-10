"use client";

import { useEffect, useRef, useState } from "react";
import { BrainCircuit, LoaderCircle } from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { DocumentApiError } from "@/lib/document-verification-api";
import {
  analyzeApplication,
  getAiProviderStatus,
  type AiAnalysis,
  type AiProviderStatus,
} from "@/lib/ai-analysis-api";
import { getAiAnalysisCopy } from "@/lib/ai-analysis-i18n";

function analysisError(
  cause: unknown,
  copy: ReturnType<typeof getAiAnalysisCopy>,
) {
  if (!(cause instanceof DocumentApiError)) return copy.unavailable;
  if (cause.status === 401 || cause.status === 403) return copy.authError;
  if (cause.status === 404) return copy.notFound;
  if (cause.code === "AI_ANALYSIS_NO_DATA") return copy.noData;
  if (
    cause.code === "AI_SERVICE_AUTH_NOT_CONFIGURED" ||
    cause.code === "AI_SERVICE_UNAUTHORIZED"
  ) {
    return copy.internalServiceNotConfigured;
  }
  if (cause.code === "NOT_CONFIGURED" || cause.code === "AI_NOT_CONFIGURED") {
    return copy.notConfigured;
  }
  if (cause.code === "RATE_LIMITED") return copy.rateLimited;
  if (cause.code === "INVALID_CREDENTIALS") return copy.invalidCredentials;
  if (cause.code === "ACCESS_DENIED") return copy.accessDenied;
  if (cause.code === "MODEL_OR_ENDPOINT_NOT_FOUND") return copy.modelNotFound;
  if (cause.code === "INVALID_REQUEST") return copy.invalidRequest;
  if (cause.code === "PROVIDER_ERROR") return copy.providerError;
  if (cause.code === "MODEL_ACCESS_DENIED") return copy.modelAccessDenied;
  if (
    cause.code === "TIMEOUT" ||
    cause.code === "PROVIDER_TIMEOUT" ||
    cause.code === "FASTAPI_REQUEST_TIMEOUT" ||
    cause.code === "AI_SERVICE_TIMEOUT" ||
    cause.status === 408
  ) {
    return copy.timeout;
  }
  if (
    cause.code === "INVALID_MODEL_RESPONSE" ||
    cause.code === "AI_INVALID_RESPONSE"
  ) {
    return copy.invalidResponse;
  }
  return copy.unavailable;
}

function FindingList({
  title,
  findings,
  empty,
}: {
  title: string;
  findings: string[];
  empty: string;
}) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold text-slate-800">{title}</h3>
      {findings.length ? (
        <ul className="mt-1 list-inside list-disc space-y-1 text-xs leading-5 text-slate-700">
          {findings.map((item, index) => (
            <li key={`${index}:${item}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-slate-500">{empty}</p>
      )}
    </section>
  );
}

function getProviderError(
  status: AiProviderStatus | null,
  copy: ReturnType<typeof getAiAnalysisCopy>,
) {
  if (
    !status ||
    status.status === "CONNECTED" ||
    status.status === "CONFIGURED"
  ) {
    return "";
  }
  if (status.status === "NOT_CONFIGURED") return copy.notConfigured;
  switch (status.reason) {
    case "RATE_LIMITED":
      return copy.rateLimited;
    case "TIMEOUT":
    case "PROVIDER_TIMEOUT":
    case "FASTAPI_REQUEST_TIMEOUT":
    case "AI_SERVICE_TIMEOUT":
      return copy.timeout;
    case "INVALID_CREDENTIALS":
      return copy.invalidCredentials;
    case "ACCESS_DENIED":
      return copy.accessDenied;
    case "MODEL_OR_ENDPOINT_NOT_FOUND":
      return copy.modelNotFound;
    case "INVALID_REQUEST":
      return copy.invalidRequest;
    case "PROVIDER_ERROR":
      return copy.providerError;
    case "MODEL_ACCESS_DENIED":
      return copy.modelAccessDenied;
    case "INVALID_MODEL_RESPONSE":
      return copy.invalidResponse;
    case "AI_SERVICE_AUTH_NOT_CONFIGURED":
    case "AI_SERVICE_UNAUTHORIZED":
      return copy.internalServiceNotConfigured;
    default:
      return copy.unavailable;
  }
}

export function ApplicationAiAnalysis({
  applicationId,
}: {
  applicationId: string;
}) {
  const { language } = useDashboard();
  const copy = getAiAnalysisCopy(language);
  const [analysisResult, setAnalysisResult] = useState<{
    applicationId: string;
    result: AiAnalysis;
  } | null>(null);
  const [loadingApplicationId, setLoadingApplicationId] = useState<
    string | null
  >(null);
  const [analysisErrorState, setAnalysisErrorState] = useState<{
    applicationId: string;
    error: string;
  } | null>(null);
  const [providerStatus, setProviderStatus] = useState<AiProviderStatus | null>(
    null,
  );
  const [checkingProvider, setCheckingProvider] = useState(true);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const analysisRequestId = useRef(0);
  const analysis =
    analysisResult?.applicationId === applicationId
      ? analysisResult.result
      : null;
  const loading = loadingApplicationId === applicationId;
  const error =
    analysisErrorState?.applicationId === applicationId
      ? analysisErrorState.error
      : null;

  useEffect(() => {
    analysisRequestId.current += 1;
  }, [applicationId]);

  useEffect(() => {
    let active = true;
    void getAiProviderStatus(false)
      .then((status) => {
        if (active) setProviderStatus(status);
      })
      .catch(() => {
        if (active) {
          setProviderStatus({
            provider: "Groq",
            model: "qwen/qwen3.8-27b",
            status: "UNAVAILABLE",
            reason: null,
          });
        }
      })
      .finally(() => {
        if (active) setCheckingProvider(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const providerError = getProviderError(providerStatus, copy);
  const canRunAnalysis =
    providerStatus !== null &&
    ["CONNECTED", "CONFIGURED"].includes(providerStatus.status);

  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = window.setTimeout(
      () => setRetrySeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [retrySeconds]);

  async function runAnalysis() {
    if (!canRunAnalysis || checkingProvider || loading || retrySeconds > 0) {
      return;
    }
    const requestId = ++analysisRequestId.current;
    setLoadingApplicationId(applicationId);
    setAnalysisErrorState(null);
    setAnalysisResult(null);
    try {
      const result = await analyzeApplication(applicationId, language);
      if (requestId === analysisRequestId.current) {
        setAnalysisResult({ applicationId, result });
      }
    } catch (cause) {
      if (requestId === analysisRequestId.current) {
        if (
          cause instanceof DocumentApiError &&
          cause.status === 429 &&
          cause.retryAfterSeconds !== undefined
        ) {
          setRetrySeconds(cause.retryAfterSeconds);
        }
        setAnalysisErrorState({
          applicationId,
          error:
            cause instanceof DocumentApiError &&
            cause.code === "RATE_LIMITED" &&
            cause.retryAfterSeconds !== undefined
              ? copy.rateLimitedRetry(cause.retryAfterSeconds)
              : analysisError(cause, copy),
        });
      }
    } finally {
      if (requestId === analysisRequestId.current) {
        setLoadingApplicationId(null);
      }
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-blue-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-blue-100 bg-blue-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <BrainCircuit
            size={17}
            className="text-blue-700"
            aria-hidden="true"
          />
          {copy.title}
        </h2>
        <button
          type="button"
          onClick={() => void runAnalysis()}
          disabled={
            loading || checkingProvider || !canRunAnalysis || retrySeconds > 0
          }
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-[#12243d] px-3 text-xs font-medium text-white transition hover:bg-[#1b3555] disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? (
            <LoaderCircle
              size={14}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <BrainCircuit size={14} aria-hidden="true" />
          )}
          {loading
            ? copy.analyzing
            : retrySeconds > 0
              ? copy.retryIn(retrySeconds)
              : copy.analyze}
        </button>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-5 text-amber-950">
          {analysis?.disclaimer ?? copy.disclaimer}
        </p>
        {loading && (
          <p role="status" className="text-xs text-slate-600">
            {copy.analyzing}
          </p>
        )}
        {checkingProvider && (
          <p role="status" className="text-xs text-slate-600">
            {copy.checkingConnection}
          </p>
        )}
        {!checkingProvider && providerError && (
          <p role="status" className="text-xs text-amber-800">
            {providerError}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800"
          >
            {error}
          </p>
        )}
        {analysis && (
          <div className="space-y-4" aria-live="polite">
            <p className="text-xs leading-5 text-slate-800">
              <span className="font-semibold">{copy.summary}: </span>
              {analysis.summary}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FindingList
                title={copy.missingInformation}
                findings={analysis.missingInformation}
                empty={copy.noFindings}
              />
              <FindingList
                title={copy.potentialInconsistencies}
                findings={analysis.potentialInconsistencies}
                empty={copy.noFindings}
              />
              <FindingList
                title={copy.documentObservations}
                findings={analysis.documentObservations}
                empty={copy.noFindings}
              />
              <FindingList
                title={copy.fieldVerificationObservations}
                findings={analysis.fieldVerificationObservations}
                empty={copy.noFindings}
              />
              <FindingList
                title={copy.suggestedQuestions}
                findings={analysis.suggestedQuestions}
                empty={copy.noFindings}
              />
              <FindingList
                title={copy.officerAttentionPoints}
                findings={analysis.officerAttentionPoints}
                empty={copy.noFindings}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
