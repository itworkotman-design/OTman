-- AlterEnum
ALTER TYPE "OrderNotificationType" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "OrderNotification" ADD COLUMN "scheduledFor" TIMESTAMP(3);
