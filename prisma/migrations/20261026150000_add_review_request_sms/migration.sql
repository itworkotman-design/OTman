-- AlterEnum
ALTER TYPE "OrderSmsKind" ADD VALUE 'REVIEW_REQUEST';

-- AlterEnum
ALTER TYPE "SmsTemplateKind" ADD VALUE 'REVIEW_REQUEST';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "reviewSmsSentAt" TIMESTAMP(3);
