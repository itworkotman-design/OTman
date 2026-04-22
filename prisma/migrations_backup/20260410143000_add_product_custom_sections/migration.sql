ALTER TABLE "Product"
ADD COLUMN "customSections" JSONB NOT NULL DEFAULT '[]'::jsonb;
