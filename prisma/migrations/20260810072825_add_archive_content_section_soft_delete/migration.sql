-- AlterTable
ALTER TABLE "ArchiveItemContentSection" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "position" DROP NOT NULL;
