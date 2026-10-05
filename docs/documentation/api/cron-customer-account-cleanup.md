# POST /api/cron/customer-account-cleanup

## Source

- `app/api/cron/customer-account-cleanup/route.ts`

## Responsibility

Deletes temporary customer ("My order") accounts that are no longer needed, using `runCustomerAccountCleanup` (see `docs/documentation/lib/account-lifetime.md`). It needs the bearer `CRON_SECRET` and returns `{ ok, checked, deleted }`.

**Schedule it hourly** in the external scheduler. The grace period after an order closes is only one day. Login already refuses an account that is due, even before this cron deletes it.
