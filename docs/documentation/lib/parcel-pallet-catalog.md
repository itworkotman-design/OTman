# `lib/content/parcelPalletCatalog.ts`

## Purpose
Static data for the "Pakke/pall" (Parcel/pallet) website catalog — the tree
diagram's third Varekategori alongside White Goods and Furniture. 7
delivery-type-only products (Bag/Pose, Boxes/Esker, Parcel/Kolli,
Half-pallet/Halvpall, Pallet/Pall, Envelope/Konvolutt,
Perishables-food/Ferskvarer), no install options — same shape as furniture's
own delivery-only products (e.g. Mattress), which is why this plugs into the
shared `WEBSITE_CATALOGS`/`WhiteGoodsBookingFlow` cart directly rather than
needing a bespoke flow like Moving got.

Prices are placeholders (0 kr) — see `seedParcelPalletCatalog.ts` for how a
reseed is prevented from resetting whatever staff enter via
`/dashboard/booking/editPrices`. **Not yet modeled**: the internal
dashboard's real `ProductType.PALLET` pricing behavior (a discounted rate for
the 2nd+ pallet in one order — see `lib/booking/pricing/fromProductCards.ts`).
These website products are plain flat-rate `PHYSICAL` products instead — a
deliberate scope choice, not an oversight; see
`docs/homepage-ordering-roadmap.md` §5 progress log.

Bag, Boxes, Half-pallet and Pallet each carry a `sizeInfo` (`WhiteGoodsProductSeed.sizeInfo` — max weight, optional dimensions in cm), display-only, shown as the leading summary pill on the product card via `formatSizeInfoChip` (`cardSummaryChips.ts`). Envelope has none.

Boxes, Half-pallet and Pallet each get an `UNPACKING` option (same code `WhiteGoodsProductCard` already keys its unpacking row off of); Half-pallet and Pallet additionally get `PALLET_PICKUP` ("Ta med tom pall" — we take the empty pallet away), a plain `category: "extra"` option rather than `"return"` so it doesn't pick up that category's hardcoded white-goods-recycling copy. Envelope and Bag get neither.

## Exports
- `PARCEL_PALLET_PRICE_LIST_CODE` — re-exported from `websitePriceListCodes.ts`.
- `PARCEL_PALLET_PRODUCTS: WhiteGoodsProductSeed[]`.
