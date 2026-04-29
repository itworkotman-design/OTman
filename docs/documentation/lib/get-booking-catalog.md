# Get Booking Catalog

## Source

- `lib/booking/catalog/getBookingCatalog.ts`

## Responsibility

Builds the booking catalog payload used by the order form and order APIs, combining product config, product options, special options, and global price-list settings.

## Functions

| Function | Description |
| --- | --- |
| `centsToDecimalString` | Converts stored cent values into decimal price strings for the booking catalog payload. |
| `getBookingCatalog` | Loads active products, merges product-config overrides, and returns catalog products, special options, and parsed global price-list settings. It now exposes `allowModelNumber` so the booking UI can decide whether to show the product-level model number input. |
