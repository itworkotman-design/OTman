-- AlterTable
ALTER TABLE "PriceListItem" ADD COLUMN     "discountAmountCents" INTEGER,
ADD COLUMN     "discountEndsAt" TIMESTAMP(3);
