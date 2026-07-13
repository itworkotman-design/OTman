-- Backfill for orders that were already sitting in Invoiced/Fakturert
-- status before the GDPR retention feature shipped. invoicedAt (and
-- paidAt) only get stamped by app code the moment a status *transition*
-- happens through the app — a pre-existing order that was already
-- Invoiced never passed through that code path, so it has invoicedAt =
-- NULL and is invisible to the "Invoiced orders awaiting payment"
-- warning table (which filters on invoicedAt IS NOT NULL).
--
-- deliveryDate is used as the best available stand-in for "when this
-- order was invoiced" -- there's no historical status-change timestamp
-- to draw from otherwise. This is an approximation: some orders may have
-- been invoiced well after their delivery date, but it's the closest
-- available signal and errs toward flagging orders sooner rather than
-- later.
--
-- Run STEP 1 first and review the output. Only run STEP 2 once you're
-- satisfied with what STEP 1 shows. Re-running STEP 2 is safe/idempotent
-- -- it only ever touches rows where invoicedAt IS still NULL.

-- ============================================================
-- STEP 1a: How many orders would be affected, by raw status value
-- ============================================================
SELECT lower(status) AS status_value, count(*) AS affected_orders
FROM "Order"
WHERE lower(status) IN ('invoiced', 'fakturet', 'fakturert')
  AND "invoicedAt" IS NULL
GROUP BY lower(status)
ORDER BY affected_orders DESC;

-- ============================================================
-- STEP 1b: The exact rows and exact values that would change
-- ============================================================
SELECT
  id,
  "displayId",
  status,
  "deliveryDate",
  "invoicedAt" AS current_invoiced_at,
  CASE
    WHEN "deliveryDate" ~ '^\d{4}-\d{2}-\d{2}$' THEN "deliveryDate"::timestamp
    ELSE NULL
  END AS new_invoiced_at
FROM "Order"
WHERE lower(status) IN ('invoiced', 'fakturet', 'fakturert')
  AND "invoicedAt" IS NULL
ORDER BY "displayId";

-- ============================================================
-- STEP 1c: How many of those WON'T be fixed by STEP 2, because
-- deliveryDate is missing or isn't a plain YYYY-MM-DD value
-- ============================================================
SELECT count(*) AS unfixable_missing_or_invalid_delivery_date
FROM "Order"
WHERE lower(status) IN ('invoiced', 'fakturet', 'fakturert')
  AND "invoicedAt" IS NULL
  AND ("deliveryDate" IS NULL OR "deliveryDate" !~ '^\d{4}-\d{2}-\d{2}$');

-- ============================================================
-- STEP 2: APPLY -- only run after reviewing STEP 1's output.
-- ============================================================
-- UPDATE "Order"
-- SET "invoicedAt" = "deliveryDate"::timestamp
-- WHERE lower(status) IN ('invoiced', 'fakturet', 'fakturert')
--   AND "invoicedAt" IS NULL
--   AND "deliveryDate" ~ '^\d{4}-\d{2}-\d{2}$';

-- No paidAt backfill needed -- no orders are marked Paid in production yet,
-- so there's nothing pre-existing for that column to be missing on.
