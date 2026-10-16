# `lib/orders/movingOrderCalculator.ts`

## Purpose
A homepage move in the admin calculator (`WebsiteOrderCalculator`), the same one a delivery order uses, and what a move stores
for it. Built from the move's stored lines (`Order.items`, `movingOrderItemRows`), its discount/extra and partner minus/plus
(`Order.rabatt`/`leggTil`/`subcontractorMinus`/`subcontractorPlus`) and its lines set to 0 (`pricingSnapshot.movingNulledLines`
— its own field, so the booking editor's order-extra keys never pick them up), so the calculator always matches the saved
price. Kroner, ex. VAT; incl. VAT per line, the discount and extra rounded the same way (`websiteVat.ts`). Tested.

## Functions
- `movingLineKey(item)` / `movingLineKeyFor(productCode, optionCode, end?)` — a line's stable key: product + option code, plus
  `from`/`to` for a per-end surcharge (read from the stored label). The same however the move is re-priced; the booking flow
  builds the same keys for its own lines.
- `movingOrderCalculatorView(items, adjustments, { includePartner })` — a `WebsiteOrderCalculatorView`: the move (size +
  services) as the "Moving" product (cardId 0), the floor/carry surcharges and km as "Order extras", every line with its code,
  key, customer and partner price; a line set to 0 shows 0 kr on that side and is left out of its totals (as the delivery
  engine does). Customer subtotal/discount/extra/total/totalIncVat; partner base/minus/plus/total (`null` without `includePartner`).
- `movingOrderAdjustedPricing(rows, adjustments)` — `{ priceExVat, priceSubcontractor, pricingSnapshot }`. Without adjustments
  it's exactly what booking the move stores (`movingOrderPricing`).
- `movingAdjustmentsFromOrder(order)` — the stored adjustments, lines set to 0 included.
- `movingNulledFromDraft(nulledLines)` — the calculator's `WebsiteOrderNulledLines` as one key list per side.
- `movingPriceChanges(saved, current, { includePartner })` — `PriceChangeRow`s for "Use new price": each line priced differently
  today (a line on one side only at 0 on the other); without partner prices only the customer's changes.
- `movingCustomerLiveTotals(lines, context)` — the customer's live price in "My order" with what staff set (discount, extra,
  lines set to 0), matching the server.

## Types
- `MovingAdjustments` — `{ rabatt, leggTil, subcontractorMinus, subcontractorPlus, nulledLines? }`.

`movingOrderCalculatorView` and `movingOrderAdjustedPricing` take an optional `mainGroup` (`CalculatorMainGroup`: which lines
are the order's own product and its name; default the move) — how `serviceOrderCalculator.ts` prices a service request's quote.
