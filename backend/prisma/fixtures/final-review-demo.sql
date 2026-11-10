-- Explicit, synthetic local-development fixture for demonstrating final review.
-- This file is never run by migrations or the normal application startup.
BEGIN;

INSERT INTO "Application" (
  "id",
  "applicantName",
  "village",
  "submissionDate",
  "serviceType",
  "status",
  "workflowStage",
  "hobli",
  "taluk",
  "district",
  "address",
  "annualFamilyIncome",
  "applicationPurpose",
  "priority",
  "assignedOfficerId"
)
VALUES (
  'DEMO-FINAL-REVIEW-001',
  'Janaseva AI Synthetic Demo Applicant',
  'Demo Village',
  '2026-11-09T08:00:00Z',
  'INCOME_CERTIFICATE',
  'DOCUMENTS_VERIFIED',
  'FINAL_REVIEW',
  'Demo Hobli',
  'Demo Taluk',
  'Demo District',
  'Synthetic demo address',
  100000,
  'Synthetic final-review demonstration only',
  'NORMAL',
  'demo-caseworker'
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ApplicationDocument" (
  "id", "applicationId", "category", "label", "required", "status",
  "createdAt", "updatedAt"
)
VALUES
  ('demo-final-review-identity', 'DEMO-FINAL-REVIEW-001', 'IDENTITY_PROOF', '', true, 'VERIFIED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo-final-review-ration', 'DEMO-FINAL-REVIEW-001', 'RATION_CARD', '', true, 'VERIFIED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo-final-review-income', 'DEMO-FINAL-REVIEW-001', 'INCOME_DECLARATION', '', true, 'VERIFIED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo-final-review-residence', 'DEMO-FINAL-REVIEW-001', 'RESIDENCE_PROOF', '', true, 'VERIFIED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "DocumentVersion" (
  "id", "documentId", "version", "originalFilename", "storageKey",
  "mimeType", "sizeBytes", "sha256", "status", "uploadedById",
  "uploadedAt", "verifiedById", "verifiedAt", "remarks"
)
VALUES
  ('demo-final-review-identity-v1', 'demo-final-review-identity', 1, 'Synthetic identity proof.pdf', 'demo-final-review-identity-v1.pdf', 'application/pdf', 32, repeat('1', 64), 'VERIFIED', 'demo-caseworker', CURRENT_TIMESTAMP, 'demo-authorized-officer', CURRENT_TIMESTAMP, 'Synthetic fixture metadata; no citizen document is stored.'),
  ('demo-final-review-ration-v1', 'demo-final-review-ration', 1, 'Synthetic ration card.pdf', 'demo-final-review-ration-v1.pdf', 'application/pdf', 32, repeat('2', 64), 'VERIFIED', 'demo-caseworker', CURRENT_TIMESTAMP, 'demo-authorized-officer', CURRENT_TIMESTAMP, 'Synthetic fixture metadata; no citizen document is stored.'),
  ('demo-final-review-income-v1', 'demo-final-review-income', 1, 'Synthetic income declaration.pdf', 'demo-final-review-income-v1.pdf', 'application/pdf', 32, repeat('3', 64), 'VERIFIED', 'demo-caseworker', CURRENT_TIMESTAMP, 'demo-authorized-officer', CURRENT_TIMESTAMP, 'Synthetic fixture metadata; no citizen document is stored.'),
  ('demo-final-review-residence-v1', 'demo-final-review-residence', 1, 'Synthetic residence proof.pdf', 'demo-final-review-residence-v1.pdf', 'application/pdf', 32, repeat('4', 64), 'VERIFIED', 'demo-caseworker', CURRENT_TIMESTAMP, 'demo-authorized-officer', CURRENT_TIMESTAMP, 'Synthetic fixture metadata; no citizen document is stored.')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "DocumentActivity" (
  "id", "applicationId", "documentId", "action", "previousStatus",
  "newStatus", "officerId", "timestamp", "remarks"
)
VALUES
  ('demo-final-review-identity-verified', 'DEMO-FINAL-REVIEW-001', 'demo-final-review-identity', 'DOCUMENT_VERIFIED', 'PENDING_VERIFICATION', 'VERIFIED', 'demo-authorized-officer', CURRENT_TIMESTAMP, 'Synthetic demo fixture verification.'),
  ('demo-final-review-ration-verified', 'DEMO-FINAL-REVIEW-001', 'demo-final-review-ration', 'DOCUMENT_VERIFIED', 'PENDING_VERIFICATION', 'VERIFIED', 'demo-authorized-officer', CURRENT_TIMESTAMP, 'Synthetic demo fixture verification.'),
  ('demo-final-review-income-verified', 'DEMO-FINAL-REVIEW-001', 'demo-final-review-income', 'DOCUMENT_VERIFIED', 'PENDING_VERIFICATION', 'VERIFIED', 'demo-authorized-officer', CURRENT_TIMESTAMP, 'Synthetic demo fixture verification.'),
  ('demo-final-review-residence-verified', 'DEMO-FINAL-REVIEW-001', 'demo-final-review-residence', 'DOCUMENT_VERIFIED', 'PENDING_VERIFICATION', 'VERIFIED', 'demo-authorized-officer', CURRENT_TIMESTAMP, 'Synthetic demo fixture verification.')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "FieldVerification" (
  "id", "applicationId", "assignedOfficerId", "assignedById",
  "visitVillage", "status", "checklist", "observations", "outcome",
  "reportRemarks", "followUpRequested", "submittedAt", "submittedById",
  "createdAt", "updatedAt"
)
VALUES (
  'demo-final-review-field-report',
  'DEMO-FINAL-REVIEW-001',
  'demo-va-ri-sagara',
  'demo-caseworker',
  'Demo Village',
  'SUBMITTED',
  '[
    {"key":"RESIDENTIAL_ADDRESS_CHECKED","status":"VERIFIED","remarks":"Synthetic demo observation."},
    {"key":"RESIDENCE_CONFIRMED","status":"VERIFIED","remarks":"Synthetic demo observation."},
    {"key":"HOUSEHOLD_COMPOSITION_CHECKED","status":"VERIFIED","remarks":"Synthetic demo observation."},
    {"key":"INCOME_INFORMATION_DISCUSSED","status":"VERIFIED","remarks":"Synthetic demo observation."},
    {"key":"INCOME_SOURCES_RECORDED","status":"VERIFIED","remarks":"Synthetic demo observation."},
    {"key":"SUPPORTING_INFORMATION_REVIEWED","status":"VERIFIED","remarks":"Synthetic demo observation."},
    {"key":"APPLICANT_INTERACTION_COMPLETED","status":"VERIFIED","remarks":"Synthetic demo observation."}
  ]'::jsonb,
  'Synthetic field visit report for local workflow demonstration only.',
  'INFORMATION_SUPPORTED',
  'Synthetic fixture; no real applicant or visit.',
  false,
  CURRENT_TIMESTAMP,
  'demo-va-ri-sagara',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("applicationId") DO NOTHING;

INSERT INTO "FieldVerificationActivity" (
  "id", "applicationId", "fieldVerificationId", "officerId", "action",
  "details", "timestamp"
)
VALUES (
  'demo-final-review-field-submitted',
  'DEMO-FINAL-REVIEW-001',
  'demo-final-review-field-report',
  'demo-va-ri-sagara',
  'FIELD_REPORT_SUBMITTED',
  '{"remarks":"Synthetic field report submitted for demonstration."}'::jsonb,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "DocumentActivity" (
  "id", "applicationId", "action", "officerId", "timestamp", "remarks"
)
VALUES (
  'demo-final-review-application-submitted',
  'DEMO-FINAL-REVIEW-001',
  'APPLICATION_SUBMITTED',
  'demo-caseworker',
  '2026-11-09T08:00:00Z',
  'Synthetic local final-review demonstration application.'
)
ON CONFLICT ("id") DO NOTHING;

COMMIT;
