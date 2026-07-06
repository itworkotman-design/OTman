-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('WEEKLY', 'MONTHLY', 'CUSTOM_DATES');

-- CreateEnum
CREATE TYPE "RecurringOrderOccurrenceStatus" AS ENUM ('PENDING', 'CREATED', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "recurringOrderOccurrenceDate" TEXT,
ADD COLUMN     "recurringOrderTemplateId" TEXT;

-- CreateTable
CREATE TABLE "RecurringOrderTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByMembershipId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceType" "RecurrenceType" NOT NULL,
    "recurrenceConfig" JSONB NOT NULL,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 3,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "orderDefaults" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringOrderTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringOrderOccurrence" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "occurrenceDate" TEXT NOT NULL,
    "status" "RecurringOrderOccurrenceStatus" NOT NULL DEFAULT 'PENDING',
    "orderId" TEXT,
    "failureReason" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringOrderOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringOrderTemplate_companyId_isPaused_idx" ON "RecurringOrderTemplate"("companyId", "isPaused");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringOrderOccurrence_orderId_key" ON "RecurringOrderOccurrence"("orderId");

-- CreateIndex
CREATE INDEX "RecurringOrderOccurrence_templateId_status_idx" ON "RecurringOrderOccurrence"("templateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringOrderOccurrence_templateId_occurrenceDate_key" ON "RecurringOrderOccurrence"("templateId", "occurrenceDate");

-- CreateIndex
CREATE INDEX "Order_recurringOrderTemplateId_idx" ON "Order"("recurringOrderTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_recurringOrderTemplateId_recurringOrderOccurrenceDate_key" ON "Order"("recurringOrderTemplateId", "recurringOrderOccurrenceDate");

-- AddForeignKey
ALTER TABLE "RecurringOrderTemplate" ADD CONSTRAINT "RecurringOrderTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOrderTemplate" ADD CONSTRAINT "RecurringOrderTemplate_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOrderOccurrence" ADD CONSTRAINT "RecurringOrderOccurrence_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RecurringOrderTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOrderOccurrence" ADD CONSTRAINT "RecurringOrderOccurrence_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

