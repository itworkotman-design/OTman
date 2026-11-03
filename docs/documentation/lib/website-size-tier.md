# `lib/booking/pricing/websiteSizeTier.ts`

Website only. **Other furniture** ("Andre møbler", `FN_OTHER_FURNITURE`) is
delivered as a **small** or a **large** item:

- Small: up to 1.5 m³ **and** up to 50 kg. Delivered at the product's own
  delivery prices (the same as the oven's).
- Large: over 1.5 m³ **or** over 50 kg. The heavier of the two picks wins, so a
  small but heavy item is large, and so is a big but light one. Delivered at the
  product's own large-item prices, and priced as `HEAVY` for the return and the
  no-lift floor surcharge (`cardWeightClass` in `websiteWeightClass.ts`).

The tier comes from the picked size brackets (`otherFurnitureSizeOptions.ts`):
the small volume/weight brackets are `LIGHT`, the large ones `HEAVY`
(`ProductOption.weightClass`).

The large-item prices are options of category `size_large_delivery`
(`OF_LG_FIRST_STEP`, `OF_LG_INDOOR`), one per delivery type. They are
seeded as a copy of the side-by-side fridge's delivery prices and edited in
Edit prices like any option (`staffPriced`, so a reseed keeps staff's prices).
The extra-item (2nd+ item) rate stays the product's own.

## Exports

- `SIZE_LARGE_DELIVERY_CATEGORY`, `LARGE_DELIVERY_OPTION_CODES` — the
  category and the option code per delivery type.
- `isLargeSizeCard(card, product)` — a picked size bracket is `HEAVY`.
- `withWebsiteSizeTiers(cards, catalogProducts)` — the catalog with each
  large item's product delivered at its large-item prices (a delivery type
  without an active large option keeps its own price). Everything else is
  returned as is.

## Where it's applied

On the catalog, before pricing, so choosing which item keeps the full delivery
price (`getAutomaticXtraDeliveryCardIds`) sees the large price too:

- `priceWebsiteOrder` and `buildWebsiteOrderItems` (calculator, order creation,
  re-pricing, stored lines).
- `deliveryPricePreview.ts` (the delivery options' prices on the card).

A size-priced product has one card per order (its size is the item's own), so
swapping the product's prices is per item.
