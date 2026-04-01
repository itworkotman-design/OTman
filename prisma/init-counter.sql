INSERT INTO "CompanyOrderCounter" ("companyId", "nextNumber", "updatedAt")
SELECT
  "companyId",
  MAX("orderNumber") + 1,
  NOW()
FROM "Order"
GROUP BY "companyId"
ON CONFLICT ("companyId") DO UPDATE
SET
  "nextNumber" = EXCLUDED."nextNumber",
  "updatedAt" = NOW();