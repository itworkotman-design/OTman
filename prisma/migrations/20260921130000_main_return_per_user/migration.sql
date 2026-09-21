-- Replaces the global isMainReturn flag with a per-user main return address.
DROP INDEX "CustomPickupAddress_isMainReturn_key";

-- AlterTable
ALTER TABLE "CustomPickupAddress" DROP COLUMN "isMainReturn";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mainReturnAddressId" TEXT;

-- CreateIndex
CREATE INDEX "User_mainReturnAddressId_idx" ON "User"("mainReturnAddressId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_mainReturnAddressId_fkey" FOREIGN KEY ("mainReturnAddressId") REFERENCES "CustomPickupAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
