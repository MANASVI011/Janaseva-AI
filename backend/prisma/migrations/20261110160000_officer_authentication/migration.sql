CREATE TABLE "OfficerCredential" (
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficerCredential_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "OfficerSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficerSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthLoginAttempt" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthLoginAttempt_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "OfficerCredential_username_key"
    ON "OfficerCredential"("username");
CREATE INDEX "OfficerSession_userId_expiresAt_idx"
    ON "OfficerSession"("userId", "expiresAt");
CREATE INDEX "OfficerSession_expiresAt_idx"
    ON "OfficerSession"("expiresAt");
CREATE INDEX "AuthLoginAttempt_windowStartedAt_idx"
    ON "AuthLoginAttempt"("windowStartedAt");

ALTER TABLE "OfficerCredential"
    ADD CONSTRAINT "OfficerCredential_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfficerSession"
    ADD CONSTRAINT "OfficerSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
