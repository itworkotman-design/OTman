-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mainPickupAddressId" TEXT;

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "mainPickupAddressId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customPickupAddressId" TEXT,
ADD COLUMN     "customPickupAddressName" TEXT,
ADD COLUMN     "pickupLatitude" DOUBLE PRECISION,
ADD COLUMN     "pickupLongitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "CustomPickupAddress" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomPickupAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyCustomPickupAddress" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customPickupAddressId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyCustomPickupAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomPickupAddress_isActive_idx" ON "CustomPickupAddress"("isActive");

-- CreateIndex
CREATE INDEX "CompanyCustomPickupAddress_companyId_idx" ON "CompanyCustomPickupAddress"("companyId");

-- CreateIndex
CREATE INDEX "CompanyCustomPickupAddress_customPickupAddressId_idx" ON "CompanyCustomPickupAddress"("customPickupAddressId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyCustomPickupAddress_companyId_customPickupAddressId_key" ON "CompanyCustomPickupAddress"("companyId", "customPickupAddressId");

-- CreateIndex
CREATE INDEX "User_mainPickupAddressId_idx" ON "User"("mainPickupAddressId");

-- CreateIndex
CREATE INDEX "Invite_mainPickupAddressId_idx" ON "Invite"("mainPickupAddressId");

-- CreateIndex
CREATE INDEX "Order_customPickupAddressId_idx" ON "Order"("customPickupAddressId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_mainPickupAddressId_fkey" FOREIGN KEY ("mainPickupAddressId") REFERENCES "CustomPickupAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCustomPickupAddress" ADD CONSTRAINT "CompanyCustomPickupAddress_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCustomPickupAddress" ADD CONSTRAINT "CompanyCustomPickupAddress_customPickupAddressId_fkey" FOREIGN KEY ("customPickupAddressId") REFERENCES "CustomPickupAddress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_mainPickupAddressId_fkey" FOREIGN KEY ("mainPickupAddressId") REFERENCES "CustomPickupAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customPickupAddressId_fkey" FOREIGN KEY ("customPickupAddressId") REFERENCES "CustomPickupAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

