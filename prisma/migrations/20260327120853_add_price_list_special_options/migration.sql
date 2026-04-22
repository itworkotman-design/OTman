-- CreateEnum
CREATE TYPE "SpecialOptionType" AS ENUM ('RETURN', 'XTRA');

-- CreateTable
CREATE TABLE "PriceListSpecialOption" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "type" "SpecialOptionType" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "customerPrice" DECIMAL(10,2) NOT NULL,
    "subcontractorPrice" DECIMAL(10,2) NOT NULL,
    "discountAmount" TEXT,
    "discountEndsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListSpecialOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceListSpecialOption_priceListId_type_idx" ON "PriceListSpecialOption"("priceListId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListSpecialOption_priceListId_type_code_key" ON "PriceListSpecialOption"("priceListId", "type", "code");

-- AddForeignKey
ALTER TABLE "PriceListSpecialOption" ADD CONSTRAINT "PriceListSpecialOption_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
