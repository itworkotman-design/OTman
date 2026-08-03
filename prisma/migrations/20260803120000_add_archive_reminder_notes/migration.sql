-- CreateTable
CREATE TABLE "ArchiveFolderReminderNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveFolderReminderNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchiveItemReminderNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveItemReminderNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveFolderReminderNote_folderId_key" ON "ArchiveFolderReminderNote"("folderId");

-- CreateIndex
CREATE INDEX "ArchiveFolderReminderNote_companyId_tenantId_idx" ON "ArchiveFolderReminderNote"("companyId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveItemReminderNote_itemId_key" ON "ArchiveItemReminderNote"("itemId");

-- CreateIndex
CREATE INDEX "ArchiveItemReminderNote_companyId_tenantId_idx" ON "ArchiveItemReminderNote"("companyId", "tenantId");

