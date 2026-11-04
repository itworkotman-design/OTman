# `app/api/integrations/stripe/webhook/route.ts`

## Purpose
Handles `checkout.session.completed` from Stripe. Idempotency is keyed on
the Stripe checkout session itself via `lib/orders/orderPayments.ts`'s
`recordOrderPayment` (unique `stripeCheckoutSessionId`) — **not** on order
status. The first payment on an order moves its status to `"confirmed"`; a
later top-up payment (staff added items to an already-confirmed order — see
`docs/homepage-ordering-roadmap.md` §4) records the charge and accumulates
`Order.stripeAmountChargedCents` without changing status again, logging a
`createOrderActionEvent` instead of a status-changed event.

Only the first (original) confirmation sends a customer email
(`order_confirmed`, via `sendLifecycleEmailsForOrders`) — a best-effort send
wrapped in try/catch that never fails the webhook response, since the
payment being correctly recorded matters more than the notification. Before
this, a confirmed order sent the customer no email at all, which meant the
`bestilling/endre/[token]` "request a change/addition" link (reachable from
`"confirmed"` status) had no way to reach them — see that email's own
purpose comment in `lib/orders/customerLifecycleEmails.ts`.

Each recorded payment also stores `orderSnapshot`: what the payment covered (priced lines, stops, date and the charged total, from `buildOrderStateSnapshot` in `lib/orders/paidOrderSnapshot.ts`). Later admin changes are compared against it, so "what changed and what's still due" is exact.

A top-up never moves an order back: an order already `confirmed`, `active` or `completed` keeps its status.

A session with `metadata.pendingChangeId` is a customer paying for a "My order" change: it's handed to `applyPaidChange` (`lib/customerAccounts/customerOrderPaidChange.ts`), which applies the change (or refunds the payment) and records the payment itself — none of the confirm/email work above runs.

## Functions
- `handleCheckoutSessionCompleted(session)` — the logic above.
- `POST` — signature verification, dispatches to the handler above for
  `checkout.session.completed`; all other event types are ignored (200 OK).

## Paid at booking (`HOMEPAGE_PAYMENT_MODE=stripe`)
See `docs/documentation/lib/booking-payment.md`. Every recorded payment sets `Order.paymentStatus = "paid"`. A payment on a `processing` order never confirms it: staff do. The first one on an order awaiting its booking payment (`isAwaitingBookingPayment`) logs "Payment received via Stripe" and calls `welcomePaidBookingOrder` (staff alert + "My order" login + order-received email, best-effort). A later one logs an additional payment.

`checkout.session.expired` is handled too: a session with `metadata.chargeKind === "booking"` that is still the order's `stripeCheckoutSessionId`, on an order still awaiting payment, cancels the order (`cancelUnpaidBookingOrder`). Other expired sessions are ignored. **The Stripe webhook endpoint must subscribe to both `checkout.session.completed` and `checkout.session.expired`.**

- `handleCheckoutSessionExpired(session)` — the expiry logic above.

The handlers live in `lib/stripe/checkoutSessionHandlers.ts` (shared with the reconciliation cron, `stripe-reconcile-cron.md`). `handleCheckoutSessionCompleted` returns whether it recorded a new payment. If processing a paid session throws, the route alerts staff on the order ("Stripe payment not recorded yet", `staffAlerts.ts`) and answers 500 so Stripe retries.
