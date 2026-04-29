# Booking Catalog API

## Source

- `app/api/booking/catalog/route.ts`

## Responsibility

Returns the normalized catalog payload used by the booking editor for the active or requested price list. The payload includes every active product type, including physical, labor, and pallet products, overlays price-list option prices where they exist, and returns global price-list settings such as deviation prices.

## Functions

| Function | Description |
| --- | --- |
| `centsToNokString` | Converts cent values into whole-number NOK strings for API responses. |
| `toDateInputValue` | Formats a `Date` into the `YYYY-MM-DD` string expected by the booking UI. |
| `GET` | Authenticates the caller, resolves the effective price list, normalizes product config, returns all active catalog products plus special options and parsed global settings, and keeps products visible even when they have no price-list item rows. |
