# `app/_components/site/BookingModal/whiteGoods/WhiteGoodsOrderSummary.tsx`

## Purpose
Sticky per-step order summary card shown alongside each product-list's
"options" step in `WhiteGoodsBookingFlow` — per-product line items (from
`orderSummaryLines.ts`'s sort order) plus a headline total. Holds the
Privat/Bedrift `CustomerTypeToggle`; the total line shows whichever of
ex-VAT/incl-VAT `getVatDisplayTotal` (`lib/booking/pricing/vatDisplayTotal.ts`)
picks as primary, with the other shown smaller underneath. Individual
line-item prices are always ex-VAT, unaffected by the toggle (by design —
see `docs/homepage-ordering-roadmap.md` §2).

## Functions
### `WhiteGoodsOrderSummary({ locale, products, totalExVat, totalIncVat, customerType, onCustomerTypeChange })`
`customerType`/`onCustomerTypeChange` are lifted state from
`WhiteGoodsBookingFlow`, not owned here.
