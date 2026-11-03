# Website weight classes

## Source

- `lib/products/weightClass.ts`
- `lib/booking/pricing/websiteWeightClass.ts`
- `lib/content/websiteWeightClassPrices.ts`

## Responsibility

Products (`Product.weightClass`) and assembly type options (`ProductOption.weightClass`) can have an optional weight class: `LIGHT` (0–25 kg), `MEDIUM` (26–75 kg) or `HEAVY` (75–150 kg). On a website price list with `weightClassPricing` (see [price-list-settings.md](price-list-settings.md)), the class prices two things:

- **No-lift floor surcharge**: one rate per chargeable floor for the whole order: the highest rate among its items, each at its own class on its own list. With one list, that is simply the heaviest item's class.
- **Return for recycling**: per item, at that item's own class. It replaces the return option's own price. A return that already has its own price (a return-only card's 0) keeps it.

Each item is priced by its own price list's class prices: `loadPart` (`websiteOrderCatalog.ts`) puts them on each product as `CatalogProduct.weightClassPricing`, because the merged catalog and the public catalog route only keep the first list's settings. White goods' light prices differ from furniture's. A product without a class counts as `LIGHT`. A picked assembly type with its own class overrides the product's. For example, Outdoor furniture is `MEDIUM`, but "Outdoor chair" makes it `LIGHT` and "Lounge / sofa set" makes it `HEAVY`. Likewise Other furniture takes the heavier class of its picked size brackets: over 1.5 m³ or over 50 kg is `HEAVY` (see [website-size-tier.md](website-size-tier.md)). Website only: the dashboard booking flow is unaffected.

`websiteWeightClassPrices.ts` holds the size-category table's prices (ex. VAT, as given: floor 26/49/76, return 75/150/300). The seed (`seedWebsiteCatalog`) cleans the customer prices (32/56/80 and 80/152/304) and gives the partner today's share: about 42% for the floor (the old flat surcharge's split), 60% for the return (the standard return option's split). A catalog can override some classes with `seedWebsiteCatalog`'s `weightClassPrices`: white goods use light = 75 floor / 260 return (seeded as 80 / 264 customer, 30 / 155 partner), and heavy return = the side-by-side fridge's old return price, 464.4 / 258 (seeded 472 / 260). The side-by-side fridge is the only heavy white good; the rest have no class, so they count as light (`WHITE_GOODS_WEIGHT_CLASS_PRICES`). An override is either a customer price (partner at the usual share) or both prices. The furniture classes are set in `furnitureCatalog.ts`.

## Functions

| Function | Purpose |
|---|---|
| `normalizeWeightClass` / `parseWeightClassInput` | Validate a class; the input variant also lets `null` (clear) and missing (leave as is) through. Used by the Edit prices PATCH routes. |
| `heaviestWeightClass` | The heaviest of a list of classes; `LIGHT` for an empty list. |
| `cardWeightClass` | A card's class: a picked assembly type's class, else its picked size brackets' heaviest class, else the product's, else `LIGHT`. |
| `orderWeightClass` | The heaviest card class in the order. |
| `websiteFloorSurchargeSetting` | The floor surcharge setting to charge: the highest per-item class rate (each from its own list), the light rate for an order with no priced item yet, or the flat `floorSurcharge` without weight class pricing. Also used for the booking modal's per-floor badge. |
| `websiteReturnDisplayPrice` | The return price a product card shows on its return row (WhiteGoodsProductCard): the item class price on its own list, else the option price. |
| `applyWebsiteWeightClassReturnPrices` | Sets each card's return option price (customer + partner) to its class's return price in the pricing breakdown. |
| `applyWebsiteWeightClassReturnOrderItems` | The same on the stored `RETURN_OPTION` lines, then reapplies "set to 0", so a nulled line stays 0. |
