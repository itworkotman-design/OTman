# Website order ex-VAT conversion

## Source

- `lib/orders/websiteOrderExVatConversion.ts`

## Responsibility

One-time conversion of homepage (`WHITE_GOODS`) orders stored before website prices became ex. VAT. Back then every customer amount was stored incl. VAT.

## Functions

| Function | Purpose |
|---|---|
| `convertWebsiteOrderToExVat(order)` | Divides every customer amount by 1.25 (to øre): `priceExVat` (whole kroner), `rabatt`/`leggTil`, the snapshot's customer totals, lines and custom deviation price, the booking details' `orderExtras`, and the `OrderItem` cents. The old total becomes the snapshot's `totalIncVat`, so the customer is charged exactly the same. The snapshot is marked `vatBasis: "exVat"`, and orders already marked are skipped. Partner amounts and `shownTotal` are untouched. The cards' saved catalog snapshot was incl. VAT, so it is dropped. Fields that didn't divide evenly are listed in `inexact`. |
| `catalogCustomerPricesExVat(snapshot)` | A catalog snapshot with every customer price ÷ 1.25: options, special options, delivery types, auto-delivery, custom sections and the price-list charges (km, floors, extra pickup, express, deviations…). Partner prices are unchanged. `resolveSavedCatalogPricing` tries it for converted orders, which were booked when the same catalog numbers meant incl. VAT. |
