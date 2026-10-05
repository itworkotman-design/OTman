# `lib/orders/orderPayments.ts`

## Purpose
Ledger for Stripe charges on an order (`OrderPayment` model — one row per
completed charge). An order can be paid in more than one pass: the original
total, then a later top-up once staff add items to an already-"confirmed"
order. `Order.stripeAmountChargedCents`/`stripePaymentIntentId`/
`stripeCheckoutSessionId` remain as a "latest/total" convenience snapshot for
existing readers, but `OrderPayment` is the source of truth for "how much has
actually been paid so far" and for tracing a specific charge back to its
Stripe session (support/refunds). See
`docs/homepage-ordering-roadmap.md` §4 for the decision and full design.

## Functions
- `sumOrderPayments(payments)` — total charged across every recorded payment.
- `recordOrderPayment(client, { orderId, companyId, stripeCheckoutSessionId, stripePaymentIntentId, amountChargedCents })`
  — inserts one row. **This is the webhook's idempotency guard**: returns
  `null` instead of throwing when `stripeCheckoutSessionId` already exists
  (Prisma `P2002`) — Stripe redelivering the same event, or the customer
  reloading the success page. Deliberately keyed on the Stripe session, not
  on order status — a status-based guard (the old approach) silently
  swallows a legitimate second/top-up payment on an order that's already
  `"confirmed"`.
  An optional `orderSnapshot` (see `lib/orders/paidOrderSnapshot.ts`) is stored
  on the row: what this payment covered.
