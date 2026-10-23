# `app/_components/site/BookingModal/whiteGoods/WhiteGoodsOrderSummary.tsx`

## Purpose
Sticky per-step order summary card shown alongside each product-list's
"options" step in `WhiteGoodsBookingFlow` — per-product line items (from
`orderSummaryLines.ts`'s sort order) plus a VAT breakdown and a headline total.
The headline total is whichever of ex-VAT/incl-VAT `websiteCustomerTotalDisplay`
(`lib/booking/pricing/websiteVat.ts`) picks as primary, labelled "Totalt inkl. mva"
or "Totalt eks. mva". It takes `totalExVat` and `totalIncVat`; every line is shown as `websiteCustomerPrice` (private: incl. VAT, rounded per line), and a product's total is the sum of its shown lines (per the
Privat/Bedrift answer from `CustomerTypeStep`, the flow's first step — see
`customer-type-step.md`). Above the total, small rows from `websiteVatBreakdown`
make the VAT visible: private shows "Delsum (eks. mva)" + "MVA (25%)" above
the incl. VAT total; business shows "MVA (25%)" + "Totalt inkl. mva" above
the ex. VAT total.
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

On large screens (`lg:`) the product lines and order extras sit in their own
scroll area, capped at `max(10rem, 92vh - 22rem)` (the modal's height minus
its header/padding and this card's title + totals). A long order scrolls
inside the card, and the title and total stay in view next to the steps
instead of being pushed below the modal's fold. Smaller screens are not
capped: there the card sits under the steps and the page scrolls normally.
The scroll area extends into the card's right padding (`lg:-mr-6`) so the
scrollbar sits in that white space, not over the prices; the rows inside are
held at the card's content width (`lg:w-[100cqw]`, the card being an
`@container`), so the layout looks the same with or without a scrollbar.
