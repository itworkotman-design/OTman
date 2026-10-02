-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "statusChangedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_status_statusChangedAt_idx" ON "Order"("status", "statusChangedAt");
