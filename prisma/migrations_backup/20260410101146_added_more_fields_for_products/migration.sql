-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'PALLET', 'LABOR');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "allowDeliveryTypes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowDemont" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowExtraServices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowHoursInput" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowInstallOptions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowPeopleCount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowQuantity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowReturnOptions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoXtraPerPallet" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productType" "ProductType" NOT NULL DEFAULT 'PHYSICAL';
