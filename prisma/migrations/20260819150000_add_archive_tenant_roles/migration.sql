-- CreateTable
CREATE TABLE "ArchiveTenantRoles" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "adminRoleId" TEXT NOT NULL,
    "viewerRoleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveTenantRoles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveTenantRoles_companyId_key" ON "ArchiveTenantRoles"("companyId");
