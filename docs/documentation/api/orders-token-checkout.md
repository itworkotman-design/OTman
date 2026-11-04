# `app/api/public/orders/[token]/checkout/route.ts`

## Purpose
Creates a Stripe Checkout Session for a public order, addressed by its
`actionToken`. Handles two cases:
- **Normal payment**: order status `"approved"`/`"failed"` (`isOrderPayable`)
  — charges the full order total (`getOrderChargeAmountIncVatNok`).
- **Top-up payment**: order already `"confirmed"` (paid once), or `"processing"` with a payment recorded (paid at booking), but staff have
  since added items, so there's a positive remaining balance
  (`isTopUpPayable`, `getOrderRemainingBalanceIncVatNok` — full total minus
  everything recorded in `OrderPayment` so far). Charges only that
  difference — staff send the link with "Send payment request" (`order-request-payment.md`). See `docs/homepage-ordering-roadmap.md` §4.

`session.metadata.chargeKind` (`"initial"` | `"topup"`) is set for
observability (Stripe dashboard / event logs) only — the webhook's own
accounting doesn't branch on it, since `OrderPayment` + order status already
determine correct behavior regardless.

Always creates a brand-new session per call rather than reusing one — see
the file's own top comment for why (sessions expire in ~24h, the order stays
payable for up to 3 days).

## Functions
- `POST` — resolves the order by token, decides which of the two cases
  above applies (or rejects with `ORDER_NOT_PAYABLE`), creates the Stripe
  session, stores its id on the order, returns `{ ok, url }`.

While homepage payments are manual (`HOMEPAGE_PAYMENT_MODE` not `stripe`, see `lib/payment-mode.md`) it answers `409 PAYMENTS_ARE_MANUAL` before looking anything up.

A third case, **booking payment** (`isAwaitingBookingPayment`, see `docs/documentation/lib/booking-payment.md`): a homepage order whose customer left Stripe Checkout before paying. The `/betaling/[token]` page offers a retry, which charges the full total with a short-lived `chargeKind: "booking"` session. That session replaces the order's earlier one, so only it can cancel the order on expiry. The session itself is built by `lib/stripe/orderCheckoutSession.ts`.

The Stripe item is always one line for the amount charged; its description lists every priced line of the order (`describeOrderLines`, e.g. "TV — TV-oppsett — Altibox: 1 000 kr · 27× Per km …: 1 080 kr", cut at 500 characters). It's one line because Stripe has no negative items (a discount) and per-line VAT rounding mustn't move the amount. The `/betaling/[token]` page shows the same lines as rows.
