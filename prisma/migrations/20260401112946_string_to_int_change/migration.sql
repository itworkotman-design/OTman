/*
  Warnings:

  - Made the column `orderNumber` on table `Order` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET NOT NULL;
