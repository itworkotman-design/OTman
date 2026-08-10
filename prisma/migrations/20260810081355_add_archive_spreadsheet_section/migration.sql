-- AlterEnum
ALTER TYPE "ArchiveContentSectionType" ADD VALUE 'SPREADSHEET';

-- CreateTable
CREATE TABLE "ArchiveItemSpreadsheet" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveItemSpreadsheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveItemSpreadsheet_sectionId_key" ON "ArchiveItemSpreadsheet"("sectionId");

-- CreateIndex
CREATE INDEX "ArchiveItemSpreadsheet_companyId_tenantId_itemId_idx" ON "ArchiveItemSpreadsheet"("companyId", "tenantId", "itemId");

-- AddForeignKey
ALTER TABLE "ArchiveItemSpreadsheet" ADD CONSTRAINT "ArchiveItemSpreadsheet_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ArchiveItemContentSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

