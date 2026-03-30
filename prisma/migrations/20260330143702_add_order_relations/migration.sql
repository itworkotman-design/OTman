-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByMembershipId" TEXT NOT NULL,
    "orderNumber" TEXT,
    "description" TEXT,
    "modelNr" TEXT,
    "deliveryDate" TEXT,
    "timeWindow" TEXT,
    "pickupAddress" TEXT,
    "extraPickupAddress" TEXT,
    "deliveryAddress" TEXT,
    "returnAddress" TEXT,
    "drivingDistance" TEXT,
    "customerName" TEXT,
    "phone" TEXT,
    "phoneTwo" TEXT,
    "email" TEXT,
    "customerComments" TEXT,
    "floorNo" TEXT,
    "lift" TEXT,
    "cashierName" TEXT,
    "cashierPhone" TEXT,
    "subcontractorId" TEXT,
    "subcontractor" TEXT,
    "driver" TEXT,
    "secondDriver" TEXT,
    "driverInfo" TEXT,
    "licensePlate" TEXT,
    "deviation" TEXT,
    "feeExtraWork" BOOLEAN NOT NULL DEFAULT false,
    "feeAddToOrder" BOOLEAN NOT NULL DEFAULT false,
    "statusNotes" TEXT,
    "changeCustomerId" TEXT,
    "changeCustomer" TEXT,
    "status" TEXT,
    "dontSendEmail" BOOLEAN NOT NULL DEFAULT false,
    "priceExVat" INTEGER NOT NULL DEFAULT 0,
    "priceSubcontractor" INTEGER NOT NULL DEFAULT 0,
    "rabatt" TEXT,
    "leggTil" TEXT,
    "subcontractorMinus" TEXT,
    "subcontractorPlus" TEXT,
    "productsSummary" TEXT,
    "deliveryTypeSummary" TEXT,
    "servicesSummary" TEXT,
    "productCardsSnapshot" JSONB,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,
    "productId" TEXT,
    "productCode" TEXT,
    "productName" TEXT,
    "deliveryType" TEXT,
    "itemType" TEXT NOT NULL,
    "optionId" TEXT,
    "optionCode" TEXT,
    "optionLabel" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "customerPriceCents" INTEGER,
    "subcontractorPriceCents" INTEGER,
    "rawData" JSONB,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_companyId_createdAt_idx" ON "Order"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_deliveryDate_idx" ON "Order"("deliveryDate");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderItem_optionId_idx" ON "OrderItem"("optionId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
