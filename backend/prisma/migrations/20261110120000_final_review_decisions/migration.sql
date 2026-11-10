CREATE TYPE "ApplicationDecisionType" AS ENUM (
    'APPROVE',
    'REJECT',
    'RETURN_FOR_CORRECTION'
);

CREATE TYPE "ApplicationDecisionStatus" AS ENUM (
    'APPROVED',
    'REJECTED',
    'RETURNED_FOR_CORRECTION'
);

ALTER TABLE "Application"
ADD COLUMN "decisionStatus" "ApplicationDecisionStatus";

CREATE TABLE "ApplicationDecision" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "decision" "ApplicationDecisionType" NOT NULL,
    "resultingStatus" "ApplicationDecisionStatus" NOT NULL,
    "previousStatus" "ApplicationDecisionStatus",
    "previousWorkflowStage" "ApplicationWorkflowStage" NOT NULL,
    "newWorkflowStage" "ApplicationWorkflowStage" NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApplicationDecision_applicationId_createdAt_idx"
ON "ApplicationDecision"("applicationId", "createdAt");

CREATE INDEX "ApplicationDecision_officerId_createdAt_idx"
ON "ApplicationDecision"("officerId", "createdAt");

ALTER TABLE "ApplicationDecision"
ADD CONSTRAINT "ApplicationDecision_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicationDecision"
ADD CONSTRAINT "ApplicationDecision_officerId_fkey"
FOREIGN KEY ("officerId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "User" ("id", "name", "role")
VALUES (
    'demo-authorized-officer',
    'Synthetic Demonstration Authorised Officer',
    'AUTHORIZED_OFFICER'
)
ON CONFLICT ("id") DO NOTHING;
