-- Migration: Replace Membership.priceListId with MembershipPriceList join table

-- 1. Create the new join table
CREATE TABLE IF NOT EXISTS "MembershipPriceList" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MembershipPriceList_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MembershipPriceList_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MembershipPriceList_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MembershipPriceList_membershipId_priceListId_key" UNIQUE ("membershipId", "priceListId")
);

CREATE INDEX IF NOT EXISTS "MembershipPriceList_membershipId_idx" ON "MembershipPriceList"("membershipId");
CREATE INDEX IF NOT EXISTS "MembershipPriceList_priceListId_idx" ON "MembershipPriceList"("priceListId");

-- 2. Copy existing single price list assignments into the new table
INSERT INTO "MembershipPriceList" ("id", "membershipId", "priceListId", "createdAt")
SELECT
    gen_random_uuid()::text,
    "id",
    "priceListId",
    NOW()
FROM "Membership"
WHERE "priceListId" IS NOT NULL;

-- 3. Drop the old column
ALTER TABLE "Membership" DROP COLUMN IF EXISTS "priceListId";
