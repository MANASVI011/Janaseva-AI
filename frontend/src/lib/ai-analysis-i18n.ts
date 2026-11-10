import type { Language } from "@/lib/dashboard-i18n";

const words = {
  kn: {
    title: "AI ಅರ್ಜಿ ವಿಶ್ಲೇಷಣೆ",
    analyze: "AI ಮೂಲಕ ಅರ್ಜಿಯನ್ನು ವಿಶ್ಲೇಷಿಸಿ",
    analyzing: "ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ…",
    checkingConnection: "Groq AI ಸೇವೆಯ ಲಭ್ಯತೆಯನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…",
    summary: "ಸಾರಾಂಶ",
    missingInformation: "ಕಾಣೆಯಾದ ಮಾಹಿತಿ",
    potentialInconsistencies: "ಸಂಭಾವ್ಯ ಅಸಂಗತತೆಗಳು",
    documentObservations: "ದಾಖಲೆಗಳ ವೀಕ್ಷಣೆಗಳು",
    fieldVerificationObservations: "ಸ್ಥಳ ಪರಿಶೀಲನೆ ವೀಕ್ಷಣೆಗಳು",
    suggestedQuestions: "ಸೂಚಿಸಿದ ಪ್ರಶ್ನೆಗಳು",
    officerAttentionPoints: "ಅಧಿಕಾರಿಯ ಗಮನಕ್ಕೆ",
    noFindings: "ಯಾವುದೂ ಗುರುತಿಸಲಾಗಿಲ್ಲ",
    disclaimer:
      "AI-generated assistance is advisory only. The authorized officer must independently verify all findings and make the final decision. AI ಸಹಾಯವು ಸಲಹಾತ್ಮಕ ಮಾತ್ರ; ಅಧಿಕೃತ ಅಧಿಕಾರಿಯು ಎಲ್ಲಾ ಕಂಡುಬಂದ ಅಂಶಗಳನ್ನು ಸ್ವತಂತ್ರವಾಗಿ ಪರಿಶೀಲಿಸಿ ಅಂತಿಮ ನಿರ್ಧಾರ ಮಾಡಬೇಕು.",
    authError: "AI ವಿಶ್ಲೇಷಣೆಗೆ ಅಧಿಕಾರಿ ದೃಢೀಕರಣ ಅಗತ್ಯ.",
    noData: "ವಿಶ್ಲೇಷಿಸಲು ಸಾಕಷ್ಟು ಅರ್ಜಿ ಮಾಹಿತಿ ಇಲ್ಲ.",
    notFound: "ಅರ್ಜಿ ದಾಖಲೆ ಕಂಡುಬಂದಿಲ್ಲ.",
    notConfigured: "Groq API ಕೀ ಸಂರಚಿಸಲಾಗಿಲ್ಲ.",
    rateLimited: "Groq ವಿನಂತಿ ಮಿತಿಯನ್ನು ತಲುಪಿದೆ. ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    rateLimitedRetry: (seconds: number) =>
      `Groq ವಿನಂತಿ ಮಿತಿಯನ್ನು ತಲುಪಿದೆ. ${seconds} ಸೆಕೆಂಡುಗಳ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.`,
    retryIn: (seconds: number) => `${seconds} ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ`,
    timeout: "AI ವಿಶ್ಲೇಷಣೆಯ ವಿನಂತಿಗೆ ಸಮಯ ಮೀರಿದೆ.",
    invalidResponse: "AI ಸೇವೆಯಿಂದ ಮಾನ್ಯ ವಿಶ್ಲೇಷಣೆ ಲಭ್ಯವಾಗಲಿಲ್ಲ.",
    invalidCredentials: "Groq API ಕೀ ಅಮಾನ್ಯವಾಗಿದೆ ಅಥವಾ ಹಿಂಪಡೆಯಲಾಗಿದೆ.",
    accessDenied:
      "Groq ವಿನಂತಿಗೆ ಪ್ರವೇಶ ನಿರಾಕರಿಸಲಾಗಿದೆ. ಯೋಜನೆ, ಮಾದರಿ ಅಥವಾ ನೆಟ್‌ವರ್ಕ್ ಅನುಮತಿಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.",
    modelNotFound: "Groq ನಲ್ಲಿ ಸಂರಚಿಸಿದ ಮಾದರಿ ಅಥವಾ endpoint ಕಂಡುಬಂದಿಲ್ಲ.",
    invalidRequest: "Groq ವಿಶ್ಲೇಷಣಾ ವಿನಂತಿಯನ್ನು ತಿರಸ್ಕರಿಸಿದೆ.",
    providerError: "Groq ಸೇವೆಯಲ್ಲಿ ತಾತ್ಕಾಲಿಕ ದೋಷ ಉಂಟಾಗಿದೆ.",
    modelAccessDenied:
      "Groq ಮಾದರಿ ಪ್ರವೇಶವನ್ನು ನಿರಾಕರಿಸಿದೆ. ಯೋಜನೆ ಮತ್ತು ಮಾದರಿ ಅನುಮತಿಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.",
    internalServiceNotConfigured: "ಆಂತರಿಕ AI ಸೇವೆಯ ದೃಢೀಕರಣ ಸಂರಚಿಸಲಾಗಿಲ್ಲ.",
    unavailable: "AI ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  },
  en: {
    title: "AI application analysis",
    analyze: "Analyze Application with AI",
    analyzing: "Analyzing…",
    checkingConnection: "Checking Groq AI availability…",
    summary: "Summary",
    missingInformation: "Missing information",
    potentialInconsistencies: "Potential inconsistencies",
    documentObservations: "Document observations",
    fieldVerificationObservations: "Field-verification observations",
    suggestedQuestions: "Suggested questions",
    officerAttentionPoints: "Officer attention points",
    noFindings: "None identified",
    disclaimer:
      "AI-generated assistance is advisory only. The authorized officer must independently verify all findings and make the final decision.",
    authError: "Officer authentication is required for AI analysis.",
    noData: "There is not enough application data to analyze.",
    notFound: "The application record could not be found.",
    notConfigured: "The Groq API key is not configured.",
    rateLimited: "Groq is rate limiting requests. Please retry later.",
    rateLimitedRetry: (seconds: number) =>
      `Groq rate limited this request. Please retry in ${seconds} seconds.`,
    retryIn: (seconds: number) => `Retry in ${seconds} seconds`,
    timeout: "The AI analysis request timed out.",
    invalidResponse: "The AI service did not return a valid analysis.",
    invalidCredentials: "The Groq API key is invalid or revoked.",
    accessDenied:
      "Groq denied this request. Check project, model, or network access restrictions.",
    modelNotFound: "Groq could not find the configured model or endpoint.",
    invalidRequest: "Groq rejected the analysis request.",
    providerError: "Groq returned a provider error.",
    modelAccessDenied:
      "Groq denied access to the configured model. Check project and model permissions.",
    internalServiceNotConfigured:
      "Internal AI service authentication is not configured.",
    unavailable: "The AI service is unavailable. Please retry.",
  },
} as const;

export function getAiAnalysisCopy(language: Language) {
  return words[language];
}
