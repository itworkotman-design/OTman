-- DropForeignKey
ALTER TABLE "CompanyCustomPickupAddress" DROP CONSTRAINT "CompanyCustomPickupAddress_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyCustomPickupAddress" DROP CONSTRAINT "CompanyCustomPickupAddress_customPickupAddressId_fkey";

-- DropTable
DROP TABLE "CompanyCustomPickupAddress";

-- CreateTable
CREATE TABLE "UserCustomPickupAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customPickupAddressId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCustomPickupAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserCustomPickupAddress_userId_idx" ON "UserCustomPickupAddress"("userId");

-- CreateIndex
CREATE INDEX "UserCustomPickupAddress_customPickupAddressId_idx" ON "UserCustomPickupAddress"("customPickupAddressId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCustomPickupAddress_userId_customPickupAddressId_key" ON "UserCustomPickupAddress"("userId", "customPickupAddressId");

-- AddForeignKey
ALTER TABLE "UserCustomPickupAddress" ADD CONSTRAINT "UserCustomPickupAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCustomPickupAddress" ADD CONSTRAINT "UserCustomPickupAddress_customPickupAddressId_fkey" FOREIGN KEY ("customPickupAddressId") REFERENCES "CustomPickupAddress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

