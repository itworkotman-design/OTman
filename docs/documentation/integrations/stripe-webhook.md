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

## Functions
- `handleCheckoutSessionCompleted(session)` — the logic above.
- `POST` — signature verification, dispatches to the handler above for
  `checkout.session.completed`; all other event types are ignored (200 OK).
