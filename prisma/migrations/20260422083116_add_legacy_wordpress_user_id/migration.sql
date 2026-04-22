/*
  Warnings:

  - A unique constraint covering the columns `[legacyWordpressUserId]` on the table `Membership` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[legacyWordpressUserId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "legacyWordpressUserId" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "legacyWordpressUserId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Membership_legacyWordpressUserId_key" ON "Membership"("legacyWordpressUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_legacyWordpressUserId_key" ON "User"("legacyWordpressUserId");
