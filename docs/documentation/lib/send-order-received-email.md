# `lib/orders/sendOrderReceivedEmail.ts`

## Responsibility
The "we received your order" email, sent right after a customer submits a
homepage order. `app/api/site/white-goods-order`, `moving-request` and
`special-goods-quote` call it through `welcomeWebsiteOrderCustomer` once the
order row is saved. That helper first links the customer's "My order"
account and passes `customerLogin`. (Not wired into `/tjenester` manpower or
the dead `transport-request` route.)

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
- The email (`buildOrderReceivedEmail`) has **no token action links**: no
  `actionToken` exists until staff approve/reject, and cancel / request-change
  reject "processing" orders.
- With `customerLogin` it has a "Se eller endre bestillingen" button to
  `/min-bestilling/{orderNumber}` and the username. It also says either that
  the password comes in a separate email (sent through Brevo, never Gmail —
  see `customer-credentials-email.md`), or, for a returning customer, to use
  the password they already have, with a forgot-password link.
- Customers can also reply to the email; Reply-To is the order's Email Center
  thread.
- The `order_updated` kind (`buildOrderUpdatedEmail`) is the customer's
  record of a change they made in My order: what changed and the new total.
  Only the customer edit route sends it, so it is left out of
  `LIFECYCLE_EMAIL_KINDS` (the kinds staff can resend).
- The customer-facing number in the email is `Order.orderNumber` (see
  `public-order-number.md`), not the internal `displayId`.
