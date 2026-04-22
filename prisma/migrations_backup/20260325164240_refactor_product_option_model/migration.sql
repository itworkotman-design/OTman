/*
  Warnings:

  - You are about to drop the column `productInstallationOptionId` on the `PriceListItem` table. All the data in the column will be lost.
  - You are about to drop the `InstallationOption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductInstallationOption` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[priceListId,productOptionId]` on the table `PriceListItem` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `productOptionId` to the `PriceListItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "PriceListItem" DROP CONSTRAINT "PriceListItem_productInstallationOptionId_fkey";

-- DropForeignKey
ALTER TABLE "ProductInstallationOption" DROP CONSTRAINT "ProductInstallationOption_installationOptionId_fkey";

-- DropForeignKey
ALTER TABLE "ProductInstallationOption" DROP CONSTRAINT "ProductInstallationOption_productId_fkey";

-- DropIndex
DROP INDEX "PriceListItem_priceListId_productInstallationOptionId_key";

-- DropIndex
DROP INDEX "PriceListItem_productInstallationOptionId_isActive_idx";

-- AlterTable
ALTER TABLE "PriceListItem" DROP COLUMN "productInstallationOptionId",
ADD COLUMN     "productOptionId" TEXT NOT NULL;

-- DropTable
DROP TABLE "InstallationOption";

-- DropTable
DROP TABLE "ProductInstallationOption";

-- CreateTable
CREATE TABLE "ProductOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductOption_productId_isActive_sortOrder_idx" ON "ProductOption"("productId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOption_productId_code_key" ON "ProductOption"("productId", "code");

-- CreateIndex
CREATE INDEX "PriceListItem_productOptionId_isActive_idx" ON "PriceListItem"("productOptionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListItem_priceListId_productOptionId_key" ON "PriceListItem"("priceListId", "productOptionId");

-- AddForeignKey
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_productOptionId_fkey" FOREIGN KEY ("productOptionId") REFERENCES "ProductOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
