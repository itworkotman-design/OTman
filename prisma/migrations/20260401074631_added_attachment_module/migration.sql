-- CreateTable
CREATE TABLE "OrderAttachment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priceListSpecialOptionId" TEXT,

    CONSTRAINT "OrderAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderAttachment_orderId_createdAt_idx" ON "OrderAttachment"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderAttachment" ADD CONSTRAINT "OrderAttachment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAttachment" ADD CONSTRAINT "OrderAttachment_priceListSpecialOptionId_fkey" FOREIGN KEY ("priceListSpecialOptionId") REFERENCES "PriceListSpecialOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
