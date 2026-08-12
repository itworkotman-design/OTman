-- CreateTable
CREATE TABLE "ArchiveFileDescription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveFileDescription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveFileDescription_fileId_key" ON "ArchiveFileDescription"("fileId");

-- CreateIndex
CREATE INDEX "ArchiveFileDescription_companyId_tenantId_idx" ON "ArchiveFileDescription"("companyId", "tenantId");
