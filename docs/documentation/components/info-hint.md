# `app/_components/site/BookingModal/whiteGoods/InfoHint.tsx`

## Purpose
A small "?" badge that shows extra context in a bubble on hover (or keyboard
focus), so hint text only takes up space when the customer wants it. Used for:
- a product tile's size spec (`WhiteGoodsProductGrid`);
- the product card's section hints (`SectionHeader` in `WhiteGoodsProductCard`,
  e.g. "How would you like the item delivered?");

`HoverTip` is the same bubble without a badge: the product card's option rows
(`OptionRow`: delivery types, installation options, additional services), the
"Dismantle old furniture" header and the order summary's total row
(`WhiteGoodsOrderSummary`'s "final price may vary" note, unless
`hideProductHints`) show their text while the row itself is hovered or
focused, instead of on a line of its own.

## Functions
### `HoverTip({ label })`
Place inside an element with `relative group/tip`; shows while that element is
hovered or keyboard-focused, opening upward from its left side. Its containers
must not be `overflow-hidden` (the card's option groups round their rows'
corners themselves for that reason).

### `InfoHint({ label, placement = "above" })`
`placement` keeps the bubble inside a clipping (`overflow-hidden`) parent like
the product card: `"above"` centres it over the badge; `"above-start"` opens
it upward from the badge's left edge (option rows near the card's left side);
`"below"` opens it downward from the left edge (a section header at the top of
the card's options).
