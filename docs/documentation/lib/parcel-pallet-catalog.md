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

Prices (NOK ex VAT, rounded to 5 kr when seeded):

| Product | Doorstep (customer / partner) | Extra unit | Carry-in |
|---|---|---|---|
| Pallet | 774 / 516 (`PALL S1`) | 258 / 154.80 (`PALLXTRA S1`) | off |
| Half-pallet | 580.50 / 387 (0.75 × pallet) | 193.50 / 116.10 | off |
| Envelope, Bag, Boxes | 608.88 / 402.48 (standard item) | 154.80 / 103.20 | 690.41 / 464.40 (extra 236.33 / 123.84) |

The source codes are in the white-goods workbook's "Source price codes" sheet. Add-ons:
- `UNPACKING`: 103.20 / 51.60.
- `PALLET_PICKUP`: 258 / 154.80, like a recycling return (`RETURNREC`).

Pallets are doorstep only (`deliveryTypes.indoorEnabled: false`, so the card hides carry-in; see `offersCarryIn`). None of these products offers installation only.

A second pallet in one order is charged the extra-unit rate through the shared extra-delivery rule. That rule keeps the most expensive delivery at full price and charges every other item its extra rate.

Bag, Boxes, Half-pallet and Pallet each carry a `sizeInfo` (`WhiteGoodsProductSeed.sizeInfo` — max weight, optional dimensions in cm), display-only, shown as the leading summary pill on the product card via `formatSizeInfoChip` (`cardSummaryChips.ts`). Envelope has none.

Boxes, Half-pallet and Pallet each get an `UNPACKING` option (same code `WhiteGoodsProductCard` already keys its unpacking row off of); Half-pallet and Pallet additionally get `PALLET_PICKUP` ("Ta med tom pall" — we take the empty pallet away), a plain `category: "extra"` option rather than `"return"` so it doesn't pick up that category's hardcoded white-goods-recycling copy. Envelope and Bag get neither.

## Exports
- `PARCEL_PALLET_PRICE_LIST_CODE` — re-exported from `websitePriceListCodes.ts`.
- `PARCEL_PALLET_PRODUCTS: WhiteGoodsProductSeed[]`.
