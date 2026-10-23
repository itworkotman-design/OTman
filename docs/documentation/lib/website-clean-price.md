# Website clean price

## Source

- `lib/booking/pricing/websiteCleanPrice.ts`

## Responsibility

Keeps homepage customer prices "clean". Website price lists hold prices ex. VAT and a private customer sees each one +25% (`websiteVat.ts`). A price ends in 0 incl. VAT exactly when it is a multiple of 8 ex. VAT (8 × 1.25 = 10), so customer prices are raised to the next multiple of 8, e.g. 260 (325 incl.) → 264 (330 incl.). Partner prices are never touched. Used by `scripts/clean-website-prices.ts` and, through `websiteSeedCustomerPrice` in `lib/content/whiteGoodsElectronics.ts` (5 kr rounding first, then this), by the website catalog seeds.

## Functions

| Function | Purpose |
|---|---|
| `cleanWebsiteExVatPrice(exVat, direction = "up")` | Next multiple of 8 kr (or the previous one with `"down"`). An already-clean price and 0 stay as they are. |
| `cleanWebsitePriceString(price, direction)` | The same for a price stored as text; non-numbers are returned untouched. |
| `cleanWebsiteDeliveryTypes(json)` | `Product.deliveryTypes`: each entry's `price` and `xtraPrice`. `INSTALL_ONLY` is rounded down, so it stays under doorstep delivery. |
| `cleanWebsitePriceListSettings(settings)` | The order-level fees and deviation fees. The per-km rates are left out. |
