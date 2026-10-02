# `app/_components/site/BookingModal/whiteGoods/WhiteGoodsOrderSummary.tsx`

## Purpose
Sticky per-step order summary card shown alongside each product-list's
"options" step in `WhiteGoodsBookingFlow` — per-product line items (from
`orderSummaryLines.ts`'s sort order) plus a headline total. The total line
shows whichever of ex-VAT/incl-VAT `getVatDisplayTotal`
(`lib/booking/pricing/vatDisplayTotal.ts`) picks as primary (per the
Privat/Bedrift answer from `CustomerTypeStep`, the flow's first step — see
`customer-type-step.md`), with the other shown smaller underneath.
Individual line-item prices are always ex-VAT, unaffected by that choice
(by design — see `docs/homepage-ordering-roadmap.md` §2).

## Functions
### `WhiteGoodsOrderSummary({ locale, products, totalExVat, totalIncVat, customerType })`
`customerType` is lifted, read-only state from `WhiteGoodsBookingFlow`, not
owned here — there's no toggle to change it from this component anymore
(that would ask the same question the first step already asked).

`totalFooter` (optional) replaces the card's own total and "final price may
vary" note, rendered inside the same card below a divider. The review page
(the modal's final step) passes its subtotal/VAT rows and the highlighted
"Total incl. VAT" box, so products and the final price read as one card.
