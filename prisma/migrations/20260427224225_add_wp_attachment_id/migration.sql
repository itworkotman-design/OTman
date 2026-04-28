/*
  Warnings:

  - A unique constraint covering the columns `[legacyWordpressOrderId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orderId,legacyWordpressAttachmentId]` on the table `OrderAttachment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "OrderNotificationType" ADD VALUE IF NOT EXISTS 'CAPACITY_REVIEW';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "legacyWordpressAuthorId" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "legacyWordpressOrderId" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "legacyWordpressRawMeta" JSONB;

-- AlterTable
ALTER TABLE "OrderAttachment" ADD COLUMN IF NOT EXISTS "legacyWordpressAttachmentId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Order_legacyWordpressOrderId_key" ON "Order"("legacyWordpressOrderId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OrderAttachment_orderId_legacyWordpressAttachmentId_key" ON "OrderAttachment"("orderId", "legacyWordpressAttachmentId");
