-- CreateTable
CREATE TABLE "ArchiveSharedRecentOpen" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityKind" "ArchiveReminderEntityKind" NOT NULL,
    "entityId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveSharedRecentOpen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArchiveSharedRecentOpen_companyId_tenantId_userId_openedAt_idx" ON "ArchiveSharedRecentOpen"("companyId", "tenantId", "userId", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveSharedRecentOpen_userId_entityKind_entityId_key" ON "ArchiveSharedRecentOpen"("userId", "entityKind", "entityId");
