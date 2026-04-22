/*
  Warnings:

  - You are about to drop the column `subcontractorId` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Order" DROP COLUMN "subcontractorId",
ADD COLUMN     "subcontractorMembershipId" TEXT;

-- CreateIndex
CREATE INDEX "Order_subcontractorMembershipId_idx" ON "Order"("subcontractorMembershipId");
