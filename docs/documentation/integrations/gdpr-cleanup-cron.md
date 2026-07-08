# GDPR Cleanup Cron

## Source

- `app/api/cron/gdpr-cleanup/route.ts`
- `lib/gdpr/runGdprCleanup.ts`

## Responsibility

Implements Norway's GDPR data-retention rules for `Order` records: personal
data must be anonymized once it's no longer needed for its purpose, while
`bokføringsloven` still requires keeping the accounting figures (amounts,
dates, invoice data) for years. The `Order` row itself is never deleted —
only the private end-client's PII columns get nulled out, in place.

`runGdprCleanup()` runs two independent sweeps, both skipping any order with
`gdprHold: true`:

1. **Anonymize** — 30 days after `paidAt`, clears `customerName`, `phone`,
   `phoneTwo`, `email`, `deliveryAddress`, `customerComments`, `floorNo`,
   `lift`, `customTimeContactNote` on the order, redacts its
   `OrderEmailMessage` bodies/addresses, clears related `OrderGsmTask`
   addresses, and clears `legacyWordpressRawMeta` for WordPress-imported
   orders. B2B fields (`pickupAddress`, `extraPickupAddress`,
   `extraPickupContacts`, `returnAddress`, `cashierName`, `cashierPhone`,
   `customerLabel`) are deliberately left alone — they identify the pickup
   store/subcontractor, not the private customer.
2. **POD cleanup** — 6 months after `paidAt`, deletes any GSM-sourced
   proof-of-delivery `OrderAttachment` rows (and their underlying S3/local
   files, via `deleteAttachmentFile` in
   `lib/orders/orderAttachmentStorage.ts`).

Each action writes an `OrderEvent` (`GDPR_ANONYMIZED` / `GDPR_POD_DELETED`)
carrying only field *names* and counts — never the actual values that were
cleared. Manual holds (`app/api/orders/gdpr/hold/route.ts`, requires a
reason) log `GDPR_HOLD_SET` / `GDPR_HOLD_REMOVED` the same way. All four
event types are surfaced, filterable by date range and exportable as a PDF,
in the dashboard's GDPR section (`app/_components/Dahsboard/home/GdprSection.tsx`
→ `/api/dashboard/gdpr/audit-log`, `/api/dashboard/gdpr/audit-log/pdf`).

`paidAt` and `invoicedAt` are stamped once, the first time an order's status
transitions to Paid/Betalt or Invoiced/Fakturert (same set-once pattern as
the existing `completedAt`), in both the single-order route
(`app/api/orders/[orderId]/route.ts`) and the bulk route
(`app/api/orders/bulk/route.ts`). The bulk route also refuses to move a
held order to Paid even if it's selected, reporting `skippedHeldCount`.

There is no in-process scheduler, so the sweeps only run when something
calls `POST /api/cron/gdpr-cleanup`. The exact same `runGdprCleanup()`
function backs the dashboard's manual trigger
(`POST /api/orders/gdpr/anonymize`, session-authenticated, OWNER/ADMIN
only, scoped to the caller's active company) — there is only one cleanup
code path, matching the `generateDueOccurrences()` /
`/api/automatic-orders/generate-now` relationship documented in
[scheduler-orders-cron.md](./scheduler-orders-cron.md).

## Render deployment (manual step)

This is infrastructure configuration, not something checked into the repo:

1. `CRON_SECRET` should already be set on the Render web service (the
   recurring-orders cron depends on the same variable) — reused as-is, no
   new secret needed.
2. Create a **separate** Render **Cron Job** service (don't fold this into
   the existing recurring-orders one — keeping them apart means a failure
   in one is visible independently of the other):
   - Schedule: e.g. `0 5 * * *` (once daily, ahead of the recurring-orders
     job).
   - Command:
     ```
     curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app-domain>/api/cron/gdpr-cleanup
     ```
3. Before the job's first run, apply the pending migration
   (`prisma/migrations/20260708120000_add_gdpr_retention_fields`) against
   production with `npx prisma migrate deploy` — the route will 500 with a
   Prisma "column does not exist" error until this has run, the same way it
   did locally before the migration was applied.
