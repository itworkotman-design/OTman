# `app/_components/site/BookingModal/whiteGoods/InfoHint.tsx`

## Purpose
A small "?" badge that shows extra context in a bubble on hover (or keyboard
focus), so hint text only takes up space when the customer wants it. Used for
a product tile's size spec (`WhiteGoodsProductGrid`), the product card's
section hints (`SectionHeader` in `WhiteGoodsProductCard` — e.g. "How would you
like the item delivered?") and the order summary's "final price may vary" note
next to the total (`WhiteGoodsOrderSummary`, unless `hideProductHints`).

## Functions
### `InfoHint({ label, placement = "above" })`
`"above"` centres the bubble over the badge; `"below"` opens it downward from
the badge's left edge, for spots where a bubble above would be clipped (the
product card's options sit in an `overflow-hidden` wrapper).
