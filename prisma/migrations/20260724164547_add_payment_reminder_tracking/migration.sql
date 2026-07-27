-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "paymentRequestSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_status_paymentRequestSentAt_idx" ON "Order"("status", "paymentRequestSentAt");

-- CreateIndex
CREATE INDEX "Order_status_paymentReminderSentAt_idx" ON "Order"("status", "paymentReminderSentAt");

