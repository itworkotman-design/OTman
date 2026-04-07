/*
  Warnings:

  - A unique constraint covering the columns `[companyId,displayId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "gsmExternalId" TEXT,
ADD COLUMN     "gsmLastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "gsmLastTaskState" TEXT,
ADD COLUMN     "gsmLastWebhookAt" TIMESTAMP(3),
ADD COLUMN     "gsmOrderId" TEXT,
ADD COLUMN     "gsmSentAt" TIMESTAMP(3),
ADD COLUMN     "gsmSyncStatus" TEXT;

-- AlterTable
ALTER TABLE "OrderAttachment" ADD COLUMN     "gsmDocumentId" TEXT,
ADD COLUMN     "gsmTaskId" TEXT,
ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "OrderGsmTask" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "gsmTaskId" TEXT NOT NULL,
    "gsmOrderId" TEXT,
    "category" TEXT,
    "reference" TEXT,
    "state" TEXT,
    "address" TEXT,
    "completedAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderGsmTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GsmWebhookEvent" (
    "id" TEXT NOT NULL,
    "gsmRequestId" TEXT,
    "gsmTaskId" TEXT,
    "gsmOrderId" TEXT,
    "topic" TEXT,
    "eventType" TEXT,
    "orderId" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingError" TEXT,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "GsmWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderGsmTask_gsmTaskId_key" ON "OrderGsmTask"("gsmTaskId");

-- CreateIndex
CREATE INDEX "OrderGsmTask_orderId_idx" ON "OrderGsmTask"("orderId");

-- CreateIndex
CREATE INDEX "OrderGsmTask_gsmOrderId_idx" ON "OrderGsmTask"("gsmOrderId");

-- CreateIndex
CREATE INDEX "OrderGsmTask_state_idx" ON "OrderGsmTask"("state");

-- CreateIndex
CREATE INDEX "GsmWebhookEvent_gsmRequestId_idx" ON "GsmWebhookEvent"("gsmRequestId");

-- CreateIndex
CREATE INDEX "GsmWebhookEvent_gsmTaskId_idx" ON "GsmWebhookEvent"("gsmTaskId");

-- CreateIndex
CREATE INDEX "GsmWebhookEvent_gsmOrderId_idx" ON "GsmWebhookEvent"("gsmOrderId");

-- CreateIndex
CREATE INDEX "GsmWebhookEvent_orderId_idx" ON "GsmWebhookEvent"("orderId");

-- CreateIndex
CREATE INDEX "GsmWebhookEvent_processed_receivedAt_idx" ON "GsmWebhookEvent"("processed", "receivedAt");

-- CreateIndex
CREATE INDEX "Order_gsmOrderId_idx" ON "Order"("gsmOrderId");

-- CreateIndex
CREATE INDEX "Order_gsmExternalId_idx" ON "Order"("gsmExternalId");

-- CreateIndex
CREATE INDEX "Order_gsmSyncStatus_idx" ON "Order"("gsmSyncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Order_companyId_displayId_key" ON "Order"("companyId", "displayId");

-- AddForeignKey
ALTER TABLE "OrderGsmTask" ADD CONSTRAINT "OrderGsmTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GsmWebhookEvent" ADD CONSTRAINT "GsmWebhookEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
