-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "actionToken" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "isWebsiteOrder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "stripeAmountChargedCents" INTEGER,
ADD COLUMN     "stripeCheckoutSessionId" TEXT,
ADD COLUMN     "stripePaymentIntentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_actionToken_key" ON "Order"("actionToken");

-- CreateIndex
CREATE INDEX "Order_isWebsiteOrder_status_idx" ON "Order"("isWebsiteOrder", "status");

-- CreateIndex
CREATE INDEX "Order_status_approvedAt_idx" ON "Order"("status", "approvedAt");

