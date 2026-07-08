-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "invoicedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "gdprHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "gdprHoldReason" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "gdprHoldSetAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_status_paidAt_gdprHold_gdprAnonymized_idx" ON "Order"("status", "paidAt", "gdprHold", "gdprAnonymized");
CREATE INDEX IF NOT EXISTS "Order_status_invoicedAt_idx" ON "Order"("status", "invoicedAt");

-- AlterEnum
ALTER TYPE "OrderEventType" ADD VALUE IF NOT EXISTS 'GDPR_ANONYMIZED';
ALTER TYPE "OrderEventType" ADD VALUE IF NOT EXISTS 'GDPR_POD_DELETED';
ALTER TYPE "OrderEventType" ADD VALUE IF NOT EXISTS 'GDPR_HOLD_SET';
ALTER TYPE "OrderEventType" ADD VALUE IF NOT EXISTS 'GDPR_HOLD_REMOVED';
