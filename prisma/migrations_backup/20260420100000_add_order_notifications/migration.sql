-- CreateEnum
CREATE TYPE "OrderNotificationType" AS ENUM ('MANUAL_REVIEW', 'GSM_REVIEW');

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "lastNotificationAt" TIMESTAMP(3),
ADD COLUMN "needsNotificationAttention" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "unreadNotificationCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "OrderNotification" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "OrderNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByMembershipId" TEXT,

    CONSTRAINT "OrderNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_needsNotificationAttention_lastNotificationAt_idx" ON "Order"("needsNotificationAttention", "lastNotificationAt");

-- CreateIndex
CREATE INDEX "OrderNotification_orderId_createdAt_idx" ON "OrderNotification"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderNotification_companyId_resolvedAt_createdAt_idx" ON "OrderNotification"("companyId", "resolvedAt", "createdAt");

-- CreateIndex
CREATE INDEX "OrderNotification_resolvedByMembershipId_createdAt_idx" ON "OrderNotification"("resolvedByMembershipId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderNotification" ADD CONSTRAINT "OrderNotification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderNotification" ADD CONSTRAINT "OrderNotification_resolvedByMembershipId_fkey" FOREIGN KEY ("resolvedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
