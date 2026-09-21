-- AlterTable
ALTER TABLE "CustomPickupAddress" ADD COLUMN     "isMainReturn" BOOLEAN NOT NULL DEFAULT false;

-- At most one address can be the global main return to gjenvinning.
CREATE UNIQUE INDEX "CustomPickupAddress_isMainReturn_key" ON "CustomPickupAddress"("isMainReturn") WHERE "isMainReturn" = true;
