# Weight Class Pricing Settings

## Source

- `app/_components/Dahsboard/booking/WeightClassPricingSettings.tsx`

## Responsibility

The "Weight classes" box in Edit prices → pricelist settings. A checkbox turns `weightClassPricing` on (zero-priced defaults) or off (`null`). When on, a table edits the floor price, floor partner price, return price and return partner price for each class (light/medium/heavy), ex. VAT. Saved with the rest of the pricelist settings.

Each product's own class is set in the product settings dialog of the same page ("Weight class" select; "Not set" counts as light). It is saved through `PATCH /api/products/pricelists/items/[itemId]/full` or, for a delivery-only product, `PATCH /api/products/pricelists/[pricelistId]/products/[productId]/settings`. See [website-weight-class.md](../lib/website-weight-class.md).
