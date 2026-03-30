-- CreateTable
CREATE TABLE "InvitePermission" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "permission" "Permission" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvitePermission_permission_idx" ON "InvitePermission"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "InvitePermission_inviteId_permission_key" ON "InvitePermission"("inviteId", "permission");

-- CreateIndex
CREATE INDEX "Invite_priceListId_idx" ON "Invite"("priceListId");

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitePermission" ADD CONSTRAINT "InvitePermission_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
