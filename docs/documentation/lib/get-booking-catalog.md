# Get Booking Catalog

## Source

- `lib/booking/catalog/getBookingCatalog.ts`

## Responsibility

Builds the booking catalog payload used by the order form, combining product config, product options, and special options.

## Functions

| Function | Description |
| --- | --- |
| `centsToDecimalString` | Converts stored cent values into decimal price strings for the booking catalog payload. |
| `getBookingCatalog` | Loads active products, merges product-config overrides, and returns catalog products/special options. It now exposes `allowModelNumber` so the booking UI can decide whether to show the product-level model number input. |
