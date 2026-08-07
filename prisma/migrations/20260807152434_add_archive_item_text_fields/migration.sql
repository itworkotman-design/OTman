-- CreateTable
CREATE TABLE "ArchiveItemTextField" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveItemTextField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArchiveItemTextField_companyId_tenantId_itemId_idx" ON "ArchiveItemTextField"("companyId", "tenantId", "itemId");

