-- CreateEnum
CREATE TYPE "ArchiveContentSectionType" AS ENUM ('IMAGES', 'FILES', 'TEXT_FIELDS');

-- AlterTable
ALTER TABLE "ArchiveItemTextField" ADD COLUMN     "sectionId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "ArchiveItemContentSection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "ArchiveContentSectionType" NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveItemContentSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchiveItemFileSection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveItemFileSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArchiveItemContentSection_companyId_tenantId_itemId_idx" ON "ArchiveItemContentSection"("companyId", "tenantId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveItemContentSection_itemId_position_key" ON "ArchiveItemContentSection"("itemId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveItemFileSection_fileId_key" ON "ArchiveItemFileSection"("fileId");

-- CreateIndex
CREATE INDEX "ArchiveItemFileSection_companyId_tenantId_sectionId_idx" ON "ArchiveItemFileSection"("companyId", "tenantId", "sectionId");

-- CreateIndex
CREATE INDEX "ArchiveItemTextField_sectionId_idx" ON "ArchiveItemTextField"("sectionId");

-- AddForeignKey
ALTER TABLE "ArchiveItemTextField" ADD CONSTRAINT "ArchiveItemTextField_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ArchiveItemContentSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveItemFileSection" ADD CONSTRAINT "ArchiveItemFileSection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ArchiveItemContentSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

