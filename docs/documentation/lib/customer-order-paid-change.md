# Customer Order Paid Change

## Source

- `lib/customerAccounts/customerOrderPaidChange.ts`

## Responsibility

A "My order" change that makes a paid order dearer is paid for first:

1. `startPaidChangeCheckout` (from the PUT): stores the change as an
   `OrderPendingChange` (the body as sent, minus `dryRun`; the amount; the total
   it was priced at) and opens a Stripe checkout for the amount, expiring after
   30 minutes, with `metadata.pendingChangeId`. Success/cancel return to
   `/min-bestilling/[orderNumber]?endring=betalt|avbrutt`.
2. `applyPaidChange` (from the Stripe webhook when `metadata.pendingChangeId`
   is set): claims the pending change (`PENDING` → `APPLYING`, so a redelivered
   event does nothing but make sure the payment is recorded), runs
   `editCustomerOrder` in mode `"paid"` with `shownTotal` = the paid-for total,
   then records the payment (snapshot of the changed order). Applied →
   `APPLIED` + an order action event. Not applied (refused, price moved,
   nothing changed) → the payment is refunded (`refundOrderPayments`),
   `FAILED` with the reason, and a `MANUAL_REVIEW` alert to call the customer
   (saying so if the automatic refund failed too). Status is never changed.

## Functions

| Function | Description |
| --- | --- |
| `startPaidChangeCheckout` | Holds the change and returns the Stripe checkout `url`. |
| `applyPaidChange` | Applies (or refunds) a paid change from a completed checkout session. |
