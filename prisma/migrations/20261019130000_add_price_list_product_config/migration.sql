-- CreateTable
CREATE TABLE "PriceListProductConfig" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "autoDeliveryPrice" JSONB,
    "deliveryTypes" JSONB,
    "customSections" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PriceListProductConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceListProductConfig_productId_idx" ON "PriceListProductConfig"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListProductConfig_priceListId_productId_key" ON "PriceListProductConfig"("priceListId", "productId");

-- AddForeignKey
ALTER TABLE "PriceListProductConfig" ADD CONSTRAINT "PriceListProductConfig_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListProductConfig" ADD CONSTRAINT "PriceListProductConfig_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: give every price list its own copy of the current delivery pricing
-- for each product it prices, so nothing changes on deploy and later edits in
-- one price list no longer leak into the others.
INSERT INTO "PriceListProductConfig" ("id", "priceListId", "productId", "autoDeliveryPrice", "deliveryTypes", "customSections", "updatedAt")
SELECT
    md5(pairs."priceListId" || ':' || p."id"),
    pairs."priceListId",
    p."id",
    p."autoDeliveryPrice",
    p."deliveryTypes",
    p."customSections",
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT i."priceListId", o."productId"
    FROM "PriceListItem" i
    JOIN "ProductOption" o ON o."id" = i."productOptionId"
) pairs
JOIN "Product" p ON p."id" = pairs."productId"
ON CONFLICT ("priceListId", "productId") DO NOTHING;
