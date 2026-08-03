-- AlterTable
ALTER TABLE "ArchiveFolderCode" ADD COLUMN     "sectionId" TEXT;

-- AlterTable
ALTER TABLE "ArchiveItemCode" ADD COLUMN     "sectionId" TEXT;

-- CreateTable
CREATE TABLE "ArchiveSection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parentFolderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArchiveSection_companyId_tenantId_parentFolderId_idx" ON "ArchiveSection"("companyId", "tenantId", "parentFolderId");

-- CreateIndex
CREATE INDEX "ArchiveFolderCode_sectionId_idx" ON "ArchiveFolderCode"("sectionId");

-- CreateIndex
CREATE INDEX "ArchiveItemCode_sectionId_idx" ON "ArchiveItemCode"("sectionId");

-- AddForeignKey
ALTER TABLE "ArchiveFolderCode" ADD CONSTRAINT "ArchiveFolderCode_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ArchiveSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveItemCode" ADD CONSTRAINT "ArchiveItemCode_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ArchiveSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
