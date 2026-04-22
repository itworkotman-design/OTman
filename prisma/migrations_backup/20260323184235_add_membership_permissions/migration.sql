/*
  Warnings:

  - You are about to drop the column `bookingAccess` on the `Membership` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('BOOKING_VIEW', 'BOOKING_CREATE');

-- AlterTable
ALTER TABLE "Membership" DROP COLUMN "bookingAccess";

-- DropEnum
DROP TYPE "BookingAccess";

-- CreateTable
CREATE TABLE "MembershipPermission" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "permission" "Permission" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MembershipPermission_permission_idx" ON "MembershipPermission"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPermission_membershipId_permission_key" ON "MembershipPermission"("membershipId", "permission");

-- AddForeignKey
ALTER TABLE "MembershipPermission" ADD CONSTRAINT "MembershipPermission_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
