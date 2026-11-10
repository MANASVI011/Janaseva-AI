-- Synthetic demonstration records only. Use this file in local/demo environments.
INSERT INTO "User" ("id", "name", "role")
VALUES ('demo-caseworker', 'Manasvi Gowda', 'CASEWORKER')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "User" ("id", "name", "role")
VALUES
  ('demo-va-ri-sagara', 'Synthetic Demonstration VA / RI 01', 'VA_RI'),
  ('demo-va-ri-bengaluru', 'Synthetic Demonstration VA / RI 02', 'VA_RI'),
  ('demo-va-ri-uttara-kannada', 'Synthetic Demonstration VA / RI 03', 'VA_RI')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Application" ("id", "applicantName", "village", "submissionDate", "status", "assignedOfficerId")
VALUES
  ('INC-2026-1208', 'Nandini Gowda', 'Hulikallu', '2026-11-06T09:00:00Z', 'DOCUMENTS_INCOMPLETE', 'demo-caseworker'),
  ('INC-2026-1203', 'Chetan Kumar', 'Hebbal', '2026-11-05T09:00:00Z', 'DOCUMENTS_INCOMPLETE', 'demo-caseworker'),
  ('INC-2026-1197', 'Shreya Patil', 'Kadaba', '2026-11-04T09:00:00Z', 'DOCUMENTS_INCOMPLETE', 'demo-caseworker'),
  ('INC-2026-1186', 'Darshan Nayak', 'Mallapura', '2026-11-03T09:00:00Z', 'DOCUMENTS_INCOMPLETE', 'demo-caseworker'),
  ('INC-2026-1179', 'Kavya Murthy', 'Belagodu', '2026-11-02T09:00:00Z', 'DOCUMENTS_INCOMPLETE', 'demo-caseworker'),
  ('INC-2026-1162', 'Arjun Rao', 'Somanahalli', '2026-11-01T09:00:00Z', 'DOCUMENTS_INCOMPLETE', 'demo-caseworker'),
  ('INC-2026-1151', 'Meghana Shetty', 'Honavara', '2026-10-31T09:00:00Z', 'DOCUMENTS_INCOMPLETE', 'demo-caseworker'),
  ('INC-2026-1144', 'Vinay Prasad', 'Kumble', '2026-10-29T09:00:00Z', 'DOCUMENTS_INCOMPLETE', 'demo-caseworker')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "DocumentActivity" (
  "id", "applicationId", "action", "officerId", "timestamp", "remarks"
)
SELECT
  gen_random_uuid()::text,
  application."id",
  'APPLICATION_SUBMITTED',
  application."assignedOfficerId",
  application."submissionDate",
  'Synthetic demonstration application created.'
FROM "Application" AS application
WHERE application."assignedOfficerId" = 'demo-caseworker'
  AND NOT EXISTS (
    SELECT 1
    FROM "DocumentActivity" AS activity
    WHERE activity."applicationId" = application."id"
      AND activity."action" = 'APPLICATION_SUBMITTED'
  );

INSERT INTO "DocumentRequirement" ("id", "serviceType", "category", "label", "required")
VALUES
  ('income-identity', 'INCOME_CERTIFICATE', 'IDENTITY_PROOF', '', true),
  ('income-ration', 'INCOME_CERTIFICATE', 'RATION_CARD', '', true),
  ('income-declaration', 'INCOME_CERTIFICATE', 'INCOME_DECLARATION', '', true),
  ('income-residence', 'INCOME_CERTIFICATE', 'RESIDENCE_PROOF', '', true),
  ('income-supporting', 'INCOME_CERTIFICATE', 'SUPPORTING_INCOME', '', false),
  ('income-caste', 'INCOME_CERTIFICATE', 'CASTE_CERTIFICATE', '', false),
  ('income-other', 'INCOME_CERTIFICATE', 'OTHER', 'Other supporting document', false)
ON CONFLICT ("id") DO NOTHING;
