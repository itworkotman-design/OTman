-- AlterEnum
ALTER TYPE "ArchiveContentSectionType" ADD VALUE 'TITLE';

-- CreateTable
CREATE TABLE "ArchiveItemTitle" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveItemTitle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveItemTitle_sectionId_key" ON "ArchiveItemTitle"("sectionId");

-- CreateIndex
CREATE INDEX "ArchiveItemTitle_companyId_tenantId_itemId_idx" ON "ArchiveItemTitle"("companyId", "tenantId", "itemId");

-- AddForeignKey
ALTER TABLE "ArchiveItemTitle" ADD CONSTRAINT "ArchiveItemTitle_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ArchiveItemContentSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
