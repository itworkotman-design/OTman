# Refund Order Difference

## Source

- `lib/orders/refundOrderDifference.ts`

## Responsibility

Refunds what a website-order customer has overpaid (the price went down after
they paid) through Stripe, storing the order as it is now on the refund rows so
the payment summary is settled. Logs an order action event and sends the
`refund_issued` email (best-effort). The status is left alone.

## Used by

- `POST /api/orders/[orderId]/refund-difference` — passes the amount staff saw
  as `expectedAmountCents` (`AMOUNT_CHANGED` otherwise).
- `PATCH /api/orders/bulk` — when a website order is set (back) to `confirmed`,
  e.g. after the customer made it cheaper in "My order".

## Functions

| Function | Description |
| --- | --- |
| `refundOrderDifference({ orderId, companyId, actor, expectedAmountCents? })` | `{ ok: true, refundedCents, emailFailed }` or `{ ok: false, reason, status, … }` with `NOT_FOUND`, `NOTHING_TO_REFUND`, `AMOUNT_CHANGED`, `REFUND_FAILED`, `REFUND_NOT_POSSIBLE`. |
