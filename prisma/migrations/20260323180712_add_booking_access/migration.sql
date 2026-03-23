-- CreateEnum
CREATE TYPE "BookingAccess" AS ENUM ('VIEW_ONLY', 'CREATE');

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "bookingAccess" "BookingAccess" NOT NULL DEFAULT 'VIEW_ONLY';
