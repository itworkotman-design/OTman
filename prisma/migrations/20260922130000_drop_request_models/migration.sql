-- DropForeignKey
ALTER TABLE "RequestItem" DROP CONSTRAINT "RequestItem_requestId_fkey";

-- DropForeignKey
ALTER TABLE "RequestItem" DROP CONSTRAINT "RequestItem_serviceId_fkey";

-- DropTable
DROP TABLE "RequestItem";

-- DropTable
DROP TABLE "Request";

-- DropEnum
DROP TYPE "RequestStatus";
