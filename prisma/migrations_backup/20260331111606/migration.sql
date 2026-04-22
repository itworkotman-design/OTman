/*
  Warnings:

  - You are about to drop the column `changeCustomer` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `changeCustomerId` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Order" DROP COLUMN "changeCustomer",
DROP COLUMN "changeCustomerId";
