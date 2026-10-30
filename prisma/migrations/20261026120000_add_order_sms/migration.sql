-- CreateEnum
CREATE TYPE "OrderSmsKind" AS ENUM ('MANUAL', 'DAY_OF_DELIVERY');

-- CreateEnum
CREATE TYPE "OrderSmsStatus" AS ENUM ('SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "SmsTemplateKind" AS ENUM ('MANUAL', 'DAY_OF_DELIVERY');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "dayOfDeliverySmsSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OrderSmsMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "OrderSmsKind" NOT NULL DEFAULT 'MANUAL',
    "status" "OrderSmsStatus" NOT NULL,
    "providerStatus" TEXT,
    "errorMessage" TEXT,
    "toPhone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "sentByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "statusUpdatedAt" TIMESTAMP(3),
    CONSTRAINT "OrderSmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "SmsTemplateKind" NOT NULL DEFAULT 'MANUAL',
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SmsTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderSmsMessage_externalMessageId_key" ON "OrderSmsMessage"("externalMessageId");

-- CreateIndex
CREATE INDEX "OrderSmsMessage_orderId_createdAt_idx" ON "OrderSmsMessage"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderSmsMessage_companyId_createdAt_idx" ON "OrderSmsMessage"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsTemplate_companyId_kind_idx" ON "SmsTemplate"("companyId", "kind");

-- AddForeignKey
ALTER TABLE "OrderSmsMessage" ADD CONSTRAINT "OrderSmsMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSmsMessage" ADD CONSTRAINT "OrderSmsMessage_sentByMembershipId_fkey" FOREIGN KEY ("sentByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsTemplate" ADD CONSTRAINT "SmsTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
