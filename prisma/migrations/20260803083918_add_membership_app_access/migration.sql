-- CreateEnum
CREATE TYPE "AppModule" AS ENUM ('ARCHIVE', 'BOOKING', 'WEBSITE_EDITOR', 'WEBSITE_ORDERS', 'SCHEDULER', 'USER_MANAGEMENT');

-- CreateEnum
CREATE TYPE "AppAccessLevel" AS ENUM ('VIEWER', 'ADMIN');

-- CreateTable
CREATE TABLE "MembershipAppAccess" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "module" "AppModule" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "level" "AppAccessLevel" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipAppAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteAppAccess" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "module" "AppModule" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "level" "AppAccessLevel" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InviteAppAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MembershipAppAccess_module_enabled_idx" ON "MembershipAppAccess"("module", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipAppAccess_membershipId_module_key" ON "MembershipAppAccess"("membershipId", "module");

-- CreateIndex
CREATE INDEX "InviteAppAccess_module_enabled_idx" ON "InviteAppAccess"("module", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "InviteAppAccess_inviteId_module_key" ON "InviteAppAccess"("inviteId", "module");

-- AddForeignKey
ALTER TABLE "MembershipAppAccess" ADD CONSTRAINT "MembershipAppAccess_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteAppAccess" ADD CONSTRAINT "InviteAppAccess_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

