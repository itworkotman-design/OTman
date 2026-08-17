-- CreateEnum
CREATE TYPE "DashboardSection" AS ENUM ('BOOKING_OVERVIEW', 'PEOPLE_ONLINE', 'REVIEWS', 'GDPR', 'QUICK_TASKS');

-- CreateTable
CREATE TABLE "MembershipDashboardSection" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "section" "DashboardSection" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipDashboardSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MembershipDashboardSection_section_enabled_idx" ON "MembershipDashboardSection"("section", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipDashboardSection_membershipId_section_key" ON "MembershipDashboardSection"("membershipId", "section");

-- AddForeignKey
ALTER TABLE "MembershipDashboardSection" ADD CONSTRAINT "MembershipDashboardSection_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
