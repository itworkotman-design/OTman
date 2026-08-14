-- AlterEnum
ALTER TYPE "ArchiveContentSectionType" ADD VALUE 'YOUTUBE';

-- CreateTable
CREATE TABLE "ArchiveItemYoutubeEmbed" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveItemYoutubeEmbed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveItemYoutubeEmbed_sectionId_key" ON "ArchiveItemYoutubeEmbed"("sectionId");

-- CreateIndex
CREATE INDEX "ArchiveItemYoutubeEmbed_companyId_tenantId_itemId_idx" ON "ArchiveItemYoutubeEmbed"("companyId", "tenantId", "itemId");

-- AddForeignKey
ALTER TABLE "ArchiveItemYoutubeEmbed" ADD CONSTRAINT "ArchiveItemYoutubeEmbed_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ArchiveItemContentSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

