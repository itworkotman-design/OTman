WITH numbered AS (
  SELECT
    o."id",
    o."companyId",
    ROW_NUMBER() OVER (
      PARTITION BY o."companyId"
      ORDER BY o."createdAt", o."id"
    ) AS rn
  FROM "Order" o
  WHERE o."orderNumber" IS NULL
),
company_max AS (
  SELECT
    o."companyId",
    MAX(o."orderNumber") AS max_num
  FROM "Order" o
  WHERE o."orderNumber" IS NOT NULL
  GROUP BY o."companyId"
),
to_update AS (
  SELECT
    n."id",
    COALESCE(cm.max_num, 19999) + n.rn AS new_order_number
  FROM numbered n
  LEFT JOIN company_max cm
    ON cm."companyId" = n."companyId"
)
UPDATE "Order" o
SET "orderNumber" = tu.new_order_number
FROM to_update tu
WHERE o."id" = tu."id";