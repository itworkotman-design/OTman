-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerMembershipId" TEXT;

-- CreateIndex
CREATE INDEX "Order_customerMembershipId_idx" ON "Order"("customerMembershipId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerMembershipId_fkey" FOREIGN KEY ("customerMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
