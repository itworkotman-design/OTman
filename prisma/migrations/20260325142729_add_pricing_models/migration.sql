-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "priceListId" TEXT;

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallationOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallationOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductInstallationOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "installationOptionId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductInstallationOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListItem" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "productInstallationOptionId" TEXT NOT NULL,
    "customerPriceCents" INTEGER NOT NULL,
    "subcontractorPriceCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InstallationOption_code_key" ON "InstallationOption"("code");

-- CreateIndex
CREATE INDEX "ProductInstallationOption_productId_isActive_sortOrder_idx" ON "ProductInstallationOption"("productId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductInstallationOption_installationOptionId_isActive_sor_idx" ON "ProductInstallationOption"("installationOptionId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductInstallationOption_productId_installationOptionId_key" ON "ProductInstallationOption"("productId", "installationOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceList_code_key" ON "PriceList"("code");

-- CreateIndex
CREATE INDEX "PriceListItem_priceListId_isActive_idx" ON "PriceListItem"("priceListId", "isActive");

-- CreateIndex
CREATE INDEX "PriceListItem_productInstallationOptionId_isActive_idx" ON "PriceListItem"("productInstallationOptionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListItem_priceListId_productInstallationOptionId_key" ON "PriceListItem"("priceListId", "productInstallationOptionId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInstallationOption" ADD CONSTRAINT "ProductInstallationOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInstallationOption" ADD CONSTRAINT "ProductInstallationOption_installationOptionId_fkey" FOREIGN KEY ("installationOptionId") REFERENCES "InstallationOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_productInstallationOptionId_fkey" FOREIGN KEY ("productInstallationOptionId") REFERENCES "ProductInstallationOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
