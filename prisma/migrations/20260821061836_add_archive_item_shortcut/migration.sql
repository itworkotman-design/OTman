-- CreateTable
CREATE TABLE "ArchiveItemShortcut" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "targetFolderId" TEXT NOT NULL,
    "sectionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveItemShortcut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArchiveItemShortcut_companyId_tenantId_targetFolderId_idx" ON "ArchiveItemShortcut"("companyId", "tenantId", "targetFolderId");

-- CreateIndex
CREATE INDEX "ArchiveItemShortcut_itemId_idx" ON "ArchiveItemShortcut"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveItemShortcut_itemId_targetFolderId_key" ON "ArchiveItemShortcut"("itemId", "targetFolderId");

-- AddForeignKey
ALTER TABLE "ArchiveItemShortcut" ADD CONSTRAINT "ArchiveItemShortcut_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ArchiveSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

