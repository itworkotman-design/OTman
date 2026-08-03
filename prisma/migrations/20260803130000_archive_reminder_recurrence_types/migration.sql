-- AlterTable
ALTER TABLE "ArchiveFolderReminderNote" DROP COLUMN "repeatIntervalDays",
ADD COLUMN     "recurrenceConfig" JSONB,
ADD COLUMN     "recurrenceType" "RecurrenceType";

-- AlterTable
ALTER TABLE "ArchiveItemReminderNote" DROP COLUMN "repeatIntervalDays",
ADD COLUMN     "recurrenceConfig" JSONB,
ADD COLUMN     "recurrenceType" "RecurrenceType";

