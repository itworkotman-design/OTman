-- CreateEnum
CREATE TYPE "OrderEmailDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "OrderEmailStatus" AS ENUM ('SENT', 'FAILED', 'RECEIVED');

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "emailThreadToken" TEXT,
ADD COLUMN "lastInboundEmailAt" TIMESTAMP(3),
ADD COLUMN "lastOutboundEmailAt" TIMESTAMP(3),
ADD COLUMN "needsEmailAttention" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "unreadInboundEmailCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "OrderEmailMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "direction" "OrderEmailDirection" NOT NULL,
    "status" "OrderEmailStatus" NOT NULL,
    "sentByMembershipId" TEXT,
    "externalMessageId" TEXT,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toEmail" TEXT NOT NULL,
    "toName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "OrderEmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_emailThreadToken_key" ON "Order"("emailThreadToken");

-- CreateIndex
CREATE INDEX "Order_needsEmailAttention_lastInboundEmailAt_idx" ON "Order"("needsEmailAttention", "lastInboundEmailAt");

-- CreateIndex
CREATE INDEX "OrderEmailMessage_orderId_createdAt_idx" ON "OrderEmailMessage"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEmailMessage_companyId_createdAt_idx" ON "OrderEmailMessage"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEmailMessage_direction_createdAt_idx" ON "OrderEmailMessage"("direction", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEmailMessage_status_createdAt_idx" ON "OrderEmailMessage"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEmailMessage_sentByMembershipId_createdAt_idx" ON "OrderEmailMessage"("sentByMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEmailMessage_externalMessageId_idx" ON "OrderEmailMessage"("externalMessageId");

-- AddForeignKey
ALTER TABLE "OrderEmailMessage" ADD CONSTRAINT "OrderEmailMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEmailMessage" ADD CONSTRAINT "OrderEmailMessage_sentByMembershipId_fkey" FOREIGN KEY ("sentByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
