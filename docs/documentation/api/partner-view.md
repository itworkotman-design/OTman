# `app/api/orders/[orderId]/partner-view/route.ts`

## Purpose
`GET` — what `ReadOnlyOrderModal` (booking app, non-admins) shows for a homepage website order instead of re-pricing it with
the dashboard engine. Tested.

- Access: `partnerViewerRole` — the assigned partner, the order creator, or an owner/admin; anyone else gets 404.
- A delivery (`WHITE_GOODS`): its stops as booked (`details`) and the partner's price per line from the same calculator as the
  admin modal (`partnerPricesFromCalculator`); if it can't be priced, just the stored total.
- Every kind passes the order's adjustment lines (`storedAdjustmentLines` of `pricingSnapshot.adjustmentLines`, or the four
  amounts as plain lines), so the partner sees each of their own minus/plus lines with its description, like a regular order.
- A move (`MOVING`): both ends + timing (`moving`, `sizeOptions`) and its stored lines (`partnerPricesFromMovingItems`).
- A service request (`SERVICE`): each service with its job, the address and timing (`service`, without staff's quotes so the
  customer price never goes along) and the partner side of its stored lines (`partnerPricesFromServiceItems`); unquoted → no lines.
- Always the stored `priceSubcontractor` as the total, with `mismatch` when the lines don't add up to it.
- `customer` (totals) only for non-partners. Anything else → `NOT_WEBSITE_ORDER` and the modal keeps its old view.
