# Needs-Change Alerts Cron

## Source

- `app/api/cron/needs-change-alerts/route.ts`
- `lib/orders/alerts/needsChangeNoReplySweep.ts`

## Responsibility

Daily check for website orders set to "needs change" (status `rejected`)
that reach their delivery date without the customer answering. Staff get an
alert and decide what to do; nothing is cancelled automatically.

```
POST /api/cron/needs-change-alerts[?limit=N]
Authorization: Bearer <CRON_SECRET>
```

An order is alerted when all of these hold (`isAwaitingReplyOnDeliveryDay`):

- it's a website order, not GDPR-anonymized, with status `rejected` (or the legacy `avvist`);
- its `deliveryDate` (ISO) is today or earlier, in Oslo time;
- the customer hasn't emailed since it was rejected (`lastInboundEmailAt` after `rejectedAt`).
  "Be om endring" needs no check: it moves the order back to `processing`.

The alert is a `MANUAL_REVIEW` notification with
`payload = { kind: "NEEDS_CHANGE_NO_REPLY", rejectedAt }`. It's created once
per rejection: resolving it doesn't bring it back, but if the order is
rejected again later (a new `rejectedAt`), it can be alerted again.

Returns `{ ok, scanned, created, skipped, failed }`. A failure on one order is
logged and counted, and the sweep moves on.

## Render deployment (manual step)

1. `CRON_SECRET` is shared with the other cron routes.
2. Create a Render **Cron Job** service with:
   - Schedule: e.g. `0 5 * * *` (once daily, early morning — UTC, so 06:00/07:00 in Oslo).
   - Command:
     ```
     curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app-domain>/api/cron/needs-change-alerts
     ```
3. Re-running is safe: an order already alerted for its current rejection is skipped.
