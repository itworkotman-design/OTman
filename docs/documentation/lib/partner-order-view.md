# `lib/orders/partnerOrderView.ts`

## Purpose
The booking app's read-only view of a homepage website order (delivery, move or service request) for non-admins — above all the assigned
partner: the partner's price read from what's stored on the order instead of re-pricing it with the dashboard engine
(which doesn't know website pricing; a move has no product cards). Tested.

## Functions
- `partnerViewerRole(membership, order)` — same scoping as the booking list: owner/admin → `admin`; order creator → `creator`
  on orders they made; anyone else → `partner` only on orders assigned to them; else `null`. Only `partner` never sees customer prices.
- `partnerPricesFromCalculator(calculator, storedTotal)` — a delivery: the admin calculator's partner side per line (a line
  set to 0 for the partner at 0) plus partner minus/plus.
- `partnerPricesFromMovingItems(items, storedTotal, adjustments?)` — a move: its stored lines' partner prices plus the partner
  minus/plus from the admin calculator (`movingOrderCalculatorView` → `partnerPricesFromCalculator`).
- `partnerPricesFromServiceItems(items, storedTotal, adjustments?)` — a service request: the same for its quote lines and
  express/deviation, through `serviceOrderCalculatorView` (lines grouped as "Service" + "Order extras").
All total the stored `priceSubcontractor` (what's paid) and give `mismatch` (stored − lines) so a difference is shown, not hidden.
