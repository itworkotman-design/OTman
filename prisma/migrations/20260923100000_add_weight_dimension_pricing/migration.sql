-- AlterEnum
ALTER TYPE "PricingMode" ADD VALUE 'PER_KG';
ALTER TYPE "PricingMode" ADD VALUE 'PER_M3';

-- AlterTable
ALTER TABLE "ProductOption" ADD COLUMN "pricingMode" "PricingMode" NOT NULL DEFAULT 'FIXED';

-- AlterTable
ALTER TABLE "PriceListItem" ADD COLUMN "customerRatePerUnitCents" INTEGER,
ADD COLUMN "subcontractorRatePerUnitCents" INTEGER,
ADD COLUMN "customerMaxChargeCents" INTEGER,
ADD COLUMN "subcontractorMaxChargeCents" INTEGER;
