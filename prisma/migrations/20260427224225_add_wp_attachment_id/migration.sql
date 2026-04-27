/*
  Warnings:

  - A unique constraint covering the columns `[legacyWordpressOrderId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orderId,legacyWordpressAttachmentId]` on the table `OrderAttachment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "OrderNotificationType" ADD VALUE 'CAPACITY_REVIEW';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "legacyWordpressAuthorId" INTEGER,
ADD COLUMN     "legacyWordpressOrderId" INTEGER,
ADD COLUMN     "legacyWordpressRawMeta" JSONB;

-- AlterTable
ALTER TABLE "OrderAttachment" ADD COLUMN     "legacyWordpressAttachmentId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Order_legacyWordpressOrderId_key" ON "Order"("legacyWordpressOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderAttachment_orderId_legacyWordpressAttachmentId_key" ON "OrderAttachment"("orderId", "legacyWordpressAttachmentId");
