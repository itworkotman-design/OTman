/*
  Warnings:

  - The `orderNumber` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Order" DROP COLUMN "orderNumber",
ADD COLUMN     "orderNumber" INTEGER;

-- CreateTable
CREATE TABLE "CompanyOrderCounter" (
    "companyId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyOrderCounter_pkey" PRIMARY KEY ("companyId")
);
