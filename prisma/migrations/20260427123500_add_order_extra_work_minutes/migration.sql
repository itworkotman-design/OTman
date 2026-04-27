ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "extraWorkMinutes" INTEGER;
UPDATE "Order" SET "extraWorkMinutes" = 0 WHERE "extraWorkMinutes" IS NULL;
ALTER TABLE "Order" ALTER COLUMN "extraWorkMinutes" SET DEFAULT 0;
ALTER TABLE "Order" ALTER COLUMN "extraWorkMinutes" SET NOT NULL;
