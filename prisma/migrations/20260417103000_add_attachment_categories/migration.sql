CREATE TYPE "AttachmentCategory" AS ENUM ('ATTACHMENT', 'RECEIPT');

ALTER TABLE "OrderAttachment"
ADD COLUMN "category" "AttachmentCategory" NOT NULL DEFAULT 'ATTACHMENT';

ALTER TABLE "PendingOrderAttachment"
ADD COLUMN "category" "AttachmentCategory" NOT NULL DEFAULT 'ATTACHMENT';
