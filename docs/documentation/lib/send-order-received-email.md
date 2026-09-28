# `lib/orders/sendOrderReceivedEmail.ts`

## Responsibility
The "we received your order" email, sent right after a customer submits a
homepage order. Called by `app/api/site/white-goods-order`, `moving-request`
and `special-goods-quote` once the order row is saved. (Not wired into
`/tjenester` manpower or the dead `transport-request` route.)

## Functions
- `sendOrderReceivedEmail(order)` — sends an `order_received` lifecycle email
  via `sendLifecycleEmailsForOrders` (actor `SYSTEM`/"Website"). It never throws
  (the order is already saved), but the customer must never be silently left
  without it: if Gmail fails, the send throws, or the order somehow has no email,
  it raises a `MANUAL_REVIEW` staff notification ("Order-received email NOT
  sent") on the order. A failed send is also recorded as a FAILED
  `OrderEmailMessage`. Staff can resend with kind `order_received` through
  `app/api/orders/send-lifecycle-email` (no dashboard button yet).

## Notes
- Email is mandatory on all three homepage flows (server-side 422 "Required" +
  the form won't advance without a valid address).
- The email (`buildOrderReceivedEmail`) has **no action links**: no
  `actionToken` exists until staff approve/reject, and cancel / request-change
  reject "processing" orders. Customers reply to it; Reply-To is the order's
  Email Center thread.
- The customer-facing number in the email is `Order.orderNumber` (see
  `public-order-number.md`), not the internal `displayId`.
