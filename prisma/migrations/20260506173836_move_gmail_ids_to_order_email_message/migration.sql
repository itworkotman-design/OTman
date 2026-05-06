/*
  Warnings:

  - You are about to drop the column `gmailMessageId` on the `Membership` table. All the data in the column will be lost.
  - You are about to drop the column `gmailThreadId` on the `Membership` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Membership" DROP COLUMN "gmailMessageId",
DROP COLUMN "gmailThreadId";

-- AlterTable
ALTER TABLE "OrderEmailMessage" ADD COLUMN     "gmailMessageId" TEXT,
ADD COLUMN     "gmailThreadId" TEXT;
