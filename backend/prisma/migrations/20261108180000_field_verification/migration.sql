CREATE TYPE "ApplicationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "FieldVisitStatus" AS ENUM (
    'NOT_SCHEDULED',
    'SCHEDULED',
    'IN_PROGRESS',
    'DRAFT',
    'SUBMITTED',
    'FOLLOW_UP'
);
CREATE TYPE "FieldVerificationOutcome" AS ENUM (
    'INFORMATION_SUPPORTED',
    'DISCREPANCY_IDENTIFIED',
    'APPLICANT_UNAVAILABLE',
    'FURTHER_VERIFICATION_REQUIRED'
);

ALTER TABLE "Application"
    ADD COLUMN "hobli" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "taluk" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "district" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "address" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "annualFamilyIncome" INTEGER,
    ADD COLUMN "applicationPurpose" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "priority" "ApplicationPriority" NOT NULL DEFAULT 'NORMAL';

UPDATE "Application" SET
    "hobli" = 'Kasaba',
    "taluk" = 'Sagara',
    "district" = 'Shivamogga',
    "address" = 'Hulikallu, Model Road, House 12',
    "annualFamilyIncome" = 180000,
    "applicationPurpose" = 'Education scholarship',
    "priority" = 'HIGH'
WHERE "id" = 'INC-2026-1208';

UPDATE "Application" SET
    "hobli" = 'Yelahanka',
    "taluk" = 'Bengaluru North',
    "district" = 'Bengaluru Urban',
    "address" = 'Hebbal, Model Road, House 8',
    "annualFamilyIncome" = 240000,
    "applicationPurpose" = 'Education admission'
WHERE "id" = 'INC-2026-1203';

UPDATE "Application" SET
    "hobli" = 'Kadaba',
    "taluk" = 'Puttur',
    "district" = 'Dakshina Kannada',
    "address" = 'Kadaba, Model Road, House 4',
    "annualFamilyIncome" = 210000,
    "applicationPurpose" = 'Scholarship eligibility'
WHERE "id" = 'INC-2026-1197';

UPDATE "Application" SET
    "hobli" = 'Mallapura',
    "taluk" = 'Honavar',
    "district" = 'Uttara Kannada',
    "address" = 'Mallapura, Model Road, House 6',
    "annualFamilyIncome" = 195000,
    "applicationPurpose" = 'Education fee concession'
WHERE "id" = 'INC-2026-1186';

INSERT INTO "User" ("id", "name", "role", "isActive")
VALUES
    ('demo-va-ri-sagara', 'Synthetic Demonstration VA / RI 01', 'VA_RI', true),
    ('demo-va-ri-bengaluru', 'Synthetic Demonstration VA / RI 02', 'VA_RI', true),
    ('demo-va-ri-uttara-kannada', 'Synthetic Demonstration VA / RI 03', 'VA_RI', true)
ON CONFLICT ("id") DO NOTHING;

CREATE INDEX "Application_workflowStage_priority_idx"
    ON "Application"("workflowStage", "priority");

CREATE TABLE "FieldVerification" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "assignedOfficerId" TEXT,
    "assignedById" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "visitVillage" TEXT,
    "visitAddress" TEXT,
    "instructions" TEXT,
    "internalNotes" TEXT,
    "status" "FieldVisitStatus" NOT NULL DEFAULT 'NOT_SCHEDULED',
    "checklist" JSONB,
    "observations" TEXT,
    "outcome" "FieldVerificationOutcome",
    "reportRemarks" TEXT,
    "followUpRequested" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FieldVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FieldVerificationActivity" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fieldVerificationId" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FieldVerificationActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FieldVerification_applicationId_key"
    ON "FieldVerification"("applicationId");
CREATE INDEX "FieldVerification_status_scheduledAt_idx"
    ON "FieldVerification"("status", "scheduledAt");
CREATE INDEX "FieldVerification_assignedOfficerId_scheduledAt_idx"
    ON "FieldVerification"("assignedOfficerId", "scheduledAt");
CREATE INDEX "FieldVerificationActivity_applicationId_timestamp_idx"
    ON "FieldVerificationActivity"("applicationId", "timestamp");
CREATE INDEX "FieldVerificationActivity_fieldVerificationId_timestamp_idx"
    ON "FieldVerificationActivity"("fieldVerificationId", "timestamp");
CREATE INDEX "FieldVerificationActivity_officerId_timestamp_idx"
    ON "FieldVerificationActivity"("officerId", "timestamp");

ALTER TABLE "FieldVerification"
    ADD CONSTRAINT "FieldVerification_applicationId_fkey"
        FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "FieldVerification_assignedOfficerId_fkey"
        FOREIGN KEY ("assignedOfficerId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "FieldVerification_assignedById_fkey"
        FOREIGN KEY ("assignedById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "FieldVerification_submittedById_fkey"
        FOREIGN KEY ("submittedById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FieldVerificationActivity"
    ADD CONSTRAINT "FieldVerificationActivity_applicationId_fkey"
        FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "FieldVerificationActivity_fieldVerificationId_fkey"
        FOREIGN KEY ("fieldVerificationId") REFERENCES "FieldVerification"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "FieldVerificationActivity_officerId_fkey"
        FOREIGN KEY ("officerId") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
