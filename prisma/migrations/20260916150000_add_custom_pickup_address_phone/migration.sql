-- AlterTable
ALTER TABLE "CustomPickupAddress" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customPickupAddressPhone" TEXT,
ADD COLUMN     "customReturnAddressPhone" TEXT;
