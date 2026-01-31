-- Insert/ensure a Category, then insert a Service linked to it.
-- Safe for repeated runs (won't create duplicate categories).

WITH cat AS (
  INSERT INTO "Category" ("id", "name", "isActive", "sortOrder", "createdAt", "updatedAt")
  VALUES ('cat_delivery', 'Delivery', true, 0, now(), now())
  ON CONFLICT ("name") DO UPDATE
    SET "updatedAt" = now()
  RETURNING "id"
)
INSERT INTO "Service" (
  "id",
  "title",
  "description",
  "pricingMode",
  "priceCents",
  "isActive",
  "sortOrder",
  "categoryId",
  "createdAt",
  "updatedAt"
)
SELECT
  'svc_001',
  'Package Delivery',
  'Fast delivery from point A to B.',
  'FIXED',
  39900,
  true,
  0,
  cat."id",
  now(),
  now()
FROM cat
ON CONFLICT ("id") DO UPDATE
  SET
    "title" = EXCLUDED."title",
    "description" = EXCLUDED."description",
    "pricingMode" = EXCLUDED."pricingMode",
    "priceCents" = EXCLUDED."priceCents",
    "isActive" = EXCLUDED."isActive",
    "sortOrder" = EXCLUDED."sortOrder",
    "categoryId" = EXCLUDED."categoryId",
    "updatedAt" = now();
