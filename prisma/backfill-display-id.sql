WITH numbered AS (
  SELECT
    o."id",
    o."companyId",
    ROW_NUMBER() OVER (
      PARTITION BY o."companyId"
      ORDER BY o."createdAt", o."id"
    ) AS rn
  FROM "Order" o
  WHERE o."displayId" IS NULL
),
company_max AS (
  SELECT
    o."companyId",
    MAX(o."displayId") AS max_num
  FROM "Order" o
  WHERE o."displayId" IS NOT NULL
  GROUP BY o."companyId"
),
to_update AS (
  SELECT
    n."id",
    COALESCE(cm.max_num, 19999) + n.rn AS new_display_id
  FROM numbered n
  LEFT JOIN company_max cm
    ON cm."companyId" = n."companyId"
)
UPDATE "Order" o
SET "displayId" = tu.new_display_id
FROM to_update tu
WHERE o."id" = tu."id";