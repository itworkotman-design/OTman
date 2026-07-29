-- CreateEnum
CREATE TYPE "ArchiveSequenceScope" AS ENUM ('FOLDER', 'ITEM');

-- CreateTable
CREATE TABLE "ArchiveFolderCode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "localSeq" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveFolderCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchiveItemCode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "localSeq" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveItemCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchiveSequenceCounter" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parentFolderId" TEXT NOT NULL,
    "scope" "ArchiveSequenceScope" NOT NULL,
    "nextSeq" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveSequenceCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveFolderCode_folderId_key" ON "ArchiveFolderCode"("folderId");

-- CreateIndex
CREATE INDEX "ArchiveFolderCode_companyId_tenantId_idx" ON "ArchiveFolderCode"("companyId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveItemCode_itemId_key" ON "ArchiveItemCode"("itemId");

-- CreateIndex
CREATE INDEX "ArchiveItemCode_companyId_tenantId_idx" ON "ArchiveItemCode"("companyId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveSequenceCounter_companyId_tenantId_parentFolderId_sc_key" ON "ArchiveSequenceCounter"("companyId", "tenantId", "parentFolderId", "scope");

