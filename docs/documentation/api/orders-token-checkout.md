# `app/api/public/orders/[token]/checkout/route.ts`

## Purpose
Creates a Stripe Checkout Session for a public order, addressed by its
`actionToken`. Handles two cases:
- **Normal payment**: order status `"approved"`/`"failed"` (`isOrderPayable`)
  — charges the full order total (`getOrderChargeAmountIncVatNok`).
- **Top-up payment**: order already `"confirmed"` (paid once) but staff have
  since added items, so there's a positive remaining balance
  (`isTopUpPayable`, `getOrderRemainingBalanceIncVatNok` — full total minus
  everything recorded in `OrderPayment` so far). Charges only that
  difference. See `docs/homepage-ordering-roadmap.md` §4.

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
