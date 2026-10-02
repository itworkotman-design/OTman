-- Backfill statusChangedAt for orders that predate the column, from the order
-- history: latest status change (dedicated STATUS_CHANGED event, or an
-- UPDATED event whose diff includes status), else the latest of the
-- completed/invoiced/paid stamps, else creation time. Deliberately not
-- updatedAt: notification activity bumps that.
UPDATE "Order" o
SET "statusChangedAt" = COALESCE(
  (
    SELECT max(e."createdAt")
    FROM "OrderEvent" e
    WHERE e."orderId" = o."id"
      AND (
        e."type" = 'STATUS_CHANGED'
        OR (e."type" = 'UPDATED' AND e."payload"->'changes' @> '[{"field": "status"}]'::jsonb)
      )
  ),
  GREATEST(o."completedAt", o."invoicedAt", o."paidAt"),
  o."createdAt"
)
WHERE o."statusChangedAt" IS NULL;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "statusChangedAt" SET DEFAULT CURRENT_TIMESTAMP;
