-- AlterTable
ALTER TABLE "CustomPickupAddress" ADD COLUMN     "icon" TEXT NOT NULL DEFAULT 'storefront',
ADD COLUMN     "color" TEXT NOT NULL DEFAULT 'blue';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customReturnAddressId" TEXT,
ADD COLUMN     "customReturnAddressName" TEXT,
ADD COLUMN     "returnLatitude" DOUBLE PRECISION,
ADD COLUMN     "returnLongitude" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Order_customReturnAddressId_idx" ON "Order"("customReturnAddressId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customReturnAddressId_fkey" FOREIGN KEY ("customReturnAddressId") REFERENCES "CustomPickupAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
