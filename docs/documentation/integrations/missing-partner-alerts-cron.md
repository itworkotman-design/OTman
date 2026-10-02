# Missing Partner Alerts Cron

## Source

- `app/api/cron/missing-partner-alerts/route.ts`
- `lib/orders/alerts/missingPartnerSweep.ts`
- `lib/orders/partnerRequirement.ts`

## Responsibility

Daily safety net for orders that end up in a "partner required" status
(`failed`, `completed`, `invoiced`, `paid`, including legacy Norwegian aliases)
without a partner (`Order.subcontractorMembershipId` and `Order.subcontractor`
both empty).

```
POST /api/cron/missing-partner-alerts[?limit=N]
Authorization: Bearer <CRON_SECRET>
```

`runMissingPartnerAlertSweep()` picks orders whose status has been in place for
more than 24 hours, measured from `Order.statusChangedAt` (or `updatedAt` for
rows from before that column existed), and skips GDPR-anonymized orders. For
each one it calls `createNoSubcontractorAlert` with `overdue: true`, which adds
a `MANUAL_REVIEW` notification (`payload.kind = NO_SUBCONTRACTOR_ON_COMPLETE`).

It doesn't matter how the status was set. Manual edits in the order modal, the
bulk update bar and GSM webhook auto-completion all stamp `statusChangedAt`, so
every one of those orders is covered.

Re-alerting: the alert is deduplicated only against **open** alerts. While one
is unresolved, the sweep skips the order. Once an admin resolves it and the
order still has no partner, the next run creates it again. In practice that is
a daily reminder until a partner is set.

Returns `{ ok, scanned, created, skipped, failed }`. A failure on one order is
logged and counted, and the sweep moves on to the next.

Related UI: when an admin manually moves an order into one of these statuses
without a partner, `MissingPartnerDialog` asks them to either leave it without
a partner or choose one. This happens both in the order modal
(`BookingEditor`) and in the bulk update bar, where it lists the affected order
ids and offers Ignore / I'll fix it now. If the admin chooses to leave it
without a partner, the order is picked up by this cron.

## Render deployment (manual step)

1. Make sure `CRON_SECRET` is set on the web service (it is shared with the
   other cron routes).
2. Create a Render **Cron Job** service with:
   - Schedule: e.g. `0 7 * * *` (once daily).
   - Command:
     ```
     curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app-domain>/api/cron/missing-partner-alerts
     ```
3. Re-running is safe: an order with an open alert is skipped.

## Legacy orders

Orders with a display id below `20000` (`PARTNER_TRACKING_MIN_DISPLAY_ID` in `lib/orders/partnerRequirement.ts`) were imported from before the app, and most of them have no partner. They are skipped everywhere: no daily alert, no partner dialog, and no cancelled-order placeholder.
