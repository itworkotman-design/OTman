-- Business correction: all orders currently Invoiced/Fakturert with a
-- deliveryDate on or before 2026-04-30 should be marked Paid.
--
-- Decisions confirmed with the user:
--   - Cutoff field: deliveryDate
--   - Cutoff date: 2026-04-30 (inclusive)
--   - paidAt is BACKDATED to deliveryDate (not set to today). Since every
--     matching order's deliveryDate is already well over 30 days in the
--     past, this means essentially ALL of them will become immediately
--     eligible for the GDPR anonymize sweep (PII cleared) on the very
--     next cron run / manual "run now" trigger. This was flagged and
--     the user chose it deliberately -- if that's no longer wanted,
--     stop before running STEP 2.
--   - invoicedAt is backfilled the same way (to deliveryDate) if it's
--     still NULL, so the order's history stays internally consistent
--     (it really was invoiced before it was paid).
--   - Orders currently on a GDPR hold (gdprHold = true) are excluded --
--     a hold must keep blocking status changes to Paid, same rule the
--     app's own bulk-update endpoint enforces.
--
-- NOTE: this is a raw SQL correction, not a change made through the app,
-- so it will NOT appear in that order's audit history (OrderEvent) the
-- way a change made via the dashboard would. Say so if you want a
-- synthetic history entry added for these too.
--
-- Run STEP 1 first and review. Only run STEP 2 once satisfied.

-- ============================================================
-- STEP 1a: count of orders that would be updated
-- ============================================================
SELECT count(*) AS orders_to_mark_paid
FROM "Order"
WHERE lower(status) IN ('invoiced', 'fakturet', 'fakturert')
  AND "deliveryDate" ~ '^\d{4}-\d{2}-\d{2}$'
  AND "deliveryDate"::date <= '2026-04-30'
  AND "gdprHold" = false;

-- ============================================================
-- STEP 1b: sample of exact rows and exact values that would change
-- ============================================================
SELECT
  id,
  "displayId",
  status AS current_status,
  'paid' AS new_status,
  "deliveryDate",
  "paidAt" AS current_paid_at,
  "deliveryDate"::timestamp AS new_paid_at,
  "invoicedAt" AS current_invoiced_at,
  COALESCE("invoicedAt", "deliveryDate"::timestamp) AS new_invoiced_at
FROM "Order"
WHERE lower(status) IN ('invoiced', 'fakturet', 'fakturert')
  AND "deliveryDate" ~ '^\d{4}-\d{2}-\d{2}$'
  AND "deliveryDate"::date <= '2026-04-30'
  AND "gdprHold" = false
ORDER BY "displayId";

-- ============================================================
-- STEP 1c: orders excluded because they're on a GDPR hold
-- (these must stay Invoiced -- a hold blocks status changes to Paid)
-- ============================================================
SELECT count(*) AS excluded_held_orders
FROM "Order"
WHERE lower(status) IN ('invoiced', 'fakturet', 'fakturert')
  AND "deliveryDate" ~ '^\d{4}-\d{2}-\d{2}$'
  AND "deliveryDate"::date <= '2026-04-30'
  AND "gdprHold" = true;

-- ============================================================
-- STEP 1d: orders that WON'T be touched because deliveryDate is
-- missing or not a plain YYYY-MM-DD value -- these need manual review
-- ============================================================
SELECT count(*) AS excluded_missing_or_invalid_delivery_date
FROM "Order"
WHERE lower(status) IN ('invoiced', 'fakturet', 'fakturert')
  AND ("deliveryDate" IS NULL OR "deliveryDate" !~ '^\d{4}-\d{2}-\d{2}$');

-- ============================================================
-- STEP 2: APPLY -- only run after reviewing STEP 1's output.
-- ============================================================
UPDATE "Order"
SET
  status = 'paid',
  "paidAt" = "deliveryDate"::timestamp,
  "invoicedAt" = COALESCE("invoicedAt", "deliveryDate"::timestamp),
  "updatedAt" = now()
WHERE lower(status) IN ('invoiced', 'fakturet', 'fakturert')
  AND "deliveryDate" ~ '^\d{4}-\d{2}-\d{2}$'
  AND "deliveryDate"::date <= '2026-04-30'
  AND "gdprHold" = false;
