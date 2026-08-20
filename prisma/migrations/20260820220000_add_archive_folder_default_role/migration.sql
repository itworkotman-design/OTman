-- CreateTable
CREATE TABLE "ArchiveFolderDefaultRole" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveFolderDefaultRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveFolderDefaultRole_folderId_key" ON "ArchiveFolderDefaultRole"("folderId");

-- CreateIndex
CREATE INDEX "ArchiveFolderDefaultRole_companyId_idx" ON "ArchiveFolderDefaultRole"("companyId");
