# Scheduler Orders Cron

## Source

- `app/api/cron/recurring-orders/route.ts`
- `lib/orders/recurringOrders/generateDueOccurrences.ts`

## Responsibility

Recurring order templates (`RecurringOrderTemplate`) are managed from the
"Scheduler Orders" dashboard page (OWNER/ADMIN only). A template stores order
defaults plus a recurrence rule (weekly weekdays, a monthly day-of-month, or
an explicit list of custom dates) and a per-template lead time in days. There
is no in-process scheduler in this app, so a real `Order` is only generated
when something calls `POST /api/cron/recurring-orders`.

The route is authenticated with a shared secret rather than a session, since
it's meant to be called by an external scheduler:

```
POST /api/cron/recurring-orders
Authorization: Bearer <CRON_SECRET>
```

It delegates to `generateDueOccurrences()`, which scans every non-paused
template's occurrence window (today through `today + leadTimeDays`, in the
`Europe/Oslo` calendar date, not the server process's timezone) and creates a
real `Order` for any date that matches the recurrence rule and hasn't already
been generated or skipped. Each attempt is logged to
`RecurringOrderOccurrence` (`PENDING` → `CREATED`/`FAILED`), which makes the
run idempotent and catch-up-safe: a delayed, skipped, or retried cron
invocation re-derives the same window and will not create duplicate orders
(a compound unique constraint also exists directly on `Order` as a second
safety net). A stale `PENDING` row (older than 30 minutes, e.g. from a crashed
run) is automatically reclaimed and retried.

The exact same `generateDueOccurrences()` function backs the dashboard's
"Generate due scheduler orders now" button
(`POST /api/automatic-orders/generate-now`, session-authenticated,
OWNER/ADMIN only, scoped to the caller's company) — there is only one
generation code path.

## Render deployment (manual step)

This is infrastructure configuration, not something checked into the repo:

1. In the Render dashboard, set `CRON_SECRET` on the web service to a long
   random string (also set it if you create a separate Cron Job service, so
   both share the same value).
2. Create a new Render **Cron Job** service pointing at the same repository
   and branch as the web app, with:
   - Schedule: e.g. `0 6 * * *` (once daily, before business hours).
   - Command:
     ```
     curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app-domain>/api/cron/recurring-orders
     ```
3. Render can retry or manually re-trigger a Cron Job run — this is expected
   and safe because of the idempotency guarantees described above.
