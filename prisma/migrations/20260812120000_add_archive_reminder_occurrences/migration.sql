-- CreateEnum
CREATE TYPE "ArchiveReminderEntityKind" AS ENUM ('ITEM', 'FOLDER');

-- CreateEnum
CREATE TYPE "ArchiveReminderOccurrenceStatus" AS ENUM ('PENDING', 'DONE', 'SNOOZED');

-- CreateTable
CREATE TABLE "ArchiveReminderOccurrence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityKind" "ArchiveReminderEntityKind" NOT NULL,
    "entityId" TEXT NOT NULL,
    "occurrenceDate" TEXT NOT NULL,
    "status" "ArchiveReminderOccurrenceStatus" NOT NULL DEFAULT 'PENDING',
    "snoozedUntil" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveReminderOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArchiveReminderOccurrence_companyId_status_occurrenceDate_idx" ON "ArchiveReminderOccurrence"("companyId", "status", "occurrenceDate");

-- CreateIndex
CREATE INDEX "ArchiveReminderOccurrence_entityKind_entityId_status_idx" ON "ArchiveReminderOccurrence"("entityKind", "entityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveReminderOccurrence_entityKind_entityId_occurrenceDat_key" ON "ArchiveReminderOccurrence"("entityKind", "entityId", "occurrenceDate");
