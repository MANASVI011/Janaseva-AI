export type ApplicationAnalysisRequest = {
  analysisLanguage: 'kn' | 'en';
  applicationReferenceId: string;
  serviceType: string;
  applicationDetails: {
    applicationStatus: string;
    workflowStage: string;
    annualFamilyIncome: number | null;
    applicationPurpose: string | null;
  };
  documents: {
    name: string;
    documentType: string;
    verificationStatus: string;
    latestVersionStatus: string | null;
    required: boolean;
  }[];
  missingDocuments: string[];
  fieldVerification: {
    status: string;
    outcome: string | null;
    observations: string | null;
    checklistOutcomes: { item: string; outcome: string }[];
    officerRemarks: string | null;
    followUpRequirements: string[];
  } | null;
};

export type ProviderStatusResult = {
  provider: 'Groq';
  model: string;
  status: 'CONNECTED' | 'CONFIGURED' | 'NOT_CONFIGURED' | 'UNAVAILABLE';
  reason: string | null;
};
