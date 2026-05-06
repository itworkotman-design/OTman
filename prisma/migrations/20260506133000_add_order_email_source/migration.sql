CREATE TYPE "OrderEmailSource" AS ENUM ('APP', 'GMAIL');

ALTER TABLE "OrderEmailMessage"
ADD COLUMN "source" "OrderEmailSource" NOT NULL DEFAULT 'APP';