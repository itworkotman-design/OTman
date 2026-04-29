# Price List Settings

## Source

- `lib/products/priceListSettings.ts`

## Responsibility

Stores global price-list charges inside the `PriceList.description` settings blob, including extra pickup, express delivery, pallet XTRA, kilometer rates, and editable bomtur/deviation customer and subcontractor prices.

## Functions

| Function | Description |
| --- | --- |
| `createDefaultChargeSetting` | Creates a default global charge setting with code, description, customer price, and subcontractor price. |
| `createDefaultPriceListSettings` | Builds default global price-list settings, including all deviation codes from the shared deviation-fee catalog. |
| `toTextString` | Normalizes text fields with a fallback. |
| `toPriceString` | Normalizes numeric price input into a non-negative string. |
| `normalizeChargeSetting` | Normalizes one global charge setting against its defaults. |
| `normalizeDeviationSettings` | Normalizes all deviation price settings while preserving default codes. |
| `normalizePriceListSettings` | Normalizes the full settings payload and migrates legacy extra-pickup and kilometer values. |
| `parsePriceListSettings` | Reads serialized settings from the price-list description field. |
| `serializePriceListSettings` | Serializes normalized settings back into the price-list description field. |
