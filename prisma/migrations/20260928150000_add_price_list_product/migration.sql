-- CreateTable
CREATE TABLE "PriceListProduct" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceListProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceListProduct_productId_idx" ON "PriceListProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListProduct_priceListId_productId_key" ON "PriceListProduct"("priceListId", "productId");

-- AddForeignKey
ALTER TABLE "PriceListProduct" ADD CONSTRAINT "PriceListProduct_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListProduct" ADD CONSTRAINT "PriceListProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
