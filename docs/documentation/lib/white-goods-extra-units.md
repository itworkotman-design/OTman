# `lib/booking/pricing/whiteGoodsExtraUnits.ts`

## Purpose
Website-only layer: units beyond the first of a doorstep/carry-in delivery pay that delivery type's own `xtraPrice`. The shared pricing only charges them through a global XTRA special option, which the website catalogs don't have. Adds nothing when the catalog does have an XTRA option (no double charge).

## Functions
- `applyWhiteGoodsExtraUnitCharges(breakdowns, cards, products, specialOptions)` — appends the charge to each affected card's breakdown.
- `buildWhiteGoodsExtraUnitOrderItems(cards, products, specialOptions)` — the same charge as saved order lines.
