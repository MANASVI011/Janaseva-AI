-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OfficerRole" AS ENUM ('CASEWORKER', 'VA_RI', 'AUTHORIZED_OFFICER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('IDENTITY_PROOF', 'RATION_CARD', 'INCOME_DECLARATION', 'RESIDENCE_PROOF', 'SUPPORTING_INCOME', 'CASTE_CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('MISSING', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'REPLACEMENT_REQUESTED');

-- CreateEnum
CREATE TYPE "ApplicationDocumentStatus" AS ENUM ('DOCUMENT_REVIEW_PENDING', 'DOCUMENTS_VERIFIED', 'DOCUMENTS_AWAITING_REPLACEMENT', 'DOCUMENTS_INCOMPLETE', 'DOCUMENTS_REJECTED');

-- CreateEnum
CREATE TYPE "ApplicationWorkflowStage" AS ENUM ('DOCUMENT_VERIFICATION', 'FIELD_VERIFICATION', 'FINAL_REVIEW', 'COMPLETED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "OfficerRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "village" TEXT NOT NULL,
    "submissionDate" TIMESTAMP(3) NOT NULL,
    "serviceType" TEXT NOT NULL DEFAULT 'INCOME_CERTIFICATE',
    "status" "ApplicationDocumentStatus" NOT NULL DEFAULT 'DOCUMENT_REVIEW_PENDING',
    "workflowStage" "ApplicationWorkflowStage" NOT NULL DEFAULT 'DOCUMENT_VERIFICATION',
    "assignedOfficerId" TEXT,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRequirement" (
    "id" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DocumentRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "requiredReason" TEXT,
    "requestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "rejectionReason" TEXT,
    "replacementReason" TEXT,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissingDocumentRequest" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "documentId" TEXT,
    "category" "DocumentCategory" NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "MissingDocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentActivity" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "documentId" TEXT,
    "action" TEXT NOT NULL,
    "previousStatus" "DocumentStatus",
    "newStatus" "DocumentStatus",
    "officerId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,

    CONSTRAINT "DocumentActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "Application_applicantName_idx" ON "Application"("applicantName");

-- CreateIndex
CREATE INDEX "Application_village_idx" ON "Application"("village");

-- CreateIndex
CREATE INDEX "Application_submissionDate_idx" ON "Application"("submissionDate");

-- CreateIndex
CREATE INDEX "Application_status_workflowStage_idx" ON "Application"("status", "workflowStage");

-- CreateIndex
CREATE INDEX "Application_assignedOfficerId_idx" ON "Application"("assignedOfficerId");

-- CreateIndex
CREATE INDEX "DocumentRequirement_serviceType_required_idx" ON "DocumentRequirement"("serviceType", "required");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRequirement_serviceType_category_label_key" ON "DocumentRequirement"("serviceType", "category", "label");

-- CreateIndex
CREATE INDEX "ApplicationDocument_applicationId_status_idx" ON "ApplicationDocument"("applicationId", "status");

-- CreateIndex
CREATE INDEX "ApplicationDocument_category_status_idx" ON "ApplicationDocument"("category", "status");

-- CreateIndex
CREATE INDEX "ApplicationDocument_required_status_idx" ON "ApplicationDocument"("required", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDocument_applicationId_category_label_key" ON "ApplicationDocument"("applicationId", "category", "label");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_storageKey_key" ON "DocumentVersion"("storageKey");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_uploadedAt_idx" ON "DocumentVersion"("documentId", "uploadedAt");

-- CreateIndex
CREATE INDEX "DocumentVersion_status_uploadedAt_idx" ON "DocumentVersion"("status", "uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");

-- CreateIndex
CREATE INDEX "MissingDocumentRequest_applicationId_requestedAt_idx" ON "MissingDocumentRequest"("applicationId", "requestedAt");

-- CreateIndex
CREATE INDEX "MissingDocumentRequest_category_receivedAt_idx" ON "MissingDocumentRequest"("category", "receivedAt");

-- CreateIndex
CREATE INDEX "DocumentActivity_applicationId_timestamp_idx" ON "DocumentActivity"("applicationId", "timestamp");

-- CreateIndex
CREATE INDEX "DocumentActivity_documentId_timestamp_idx" ON "DocumentActivity"("documentId", "timestamp");

-- CreateIndex
CREATE INDEX "DocumentActivity_officerId_timestamp_idx" ON "DocumentActivity"("officerId", "timestamp");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_assignedOfficerId_fkey" FOREIGN KEY ("assignedOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ApplicationDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissingDocumentRequest" ADD CONSTRAINT "MissingDocumentRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissingDocumentRequest" ADD CONSTRAINT "MissingDocumentRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ApplicationDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissingDocumentRequest" ADD CONSTRAINT "MissingDocumentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentActivity" ADD CONSTRAINT "DocumentActivity_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentActivity" ADD CONSTRAINT "DocumentActivity_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ApplicationDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentActivity" ADD CONSTRAINT "DocumentActivity_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
