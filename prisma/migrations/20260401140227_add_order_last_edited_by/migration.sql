-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "lastEditedByMembershipId" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_lastEditedByMembershipId_fkey" FOREIGN KEY ("lastEditedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
