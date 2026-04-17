# Booking Catalog API

## Source

- `app/api/booking/catalog/route.ts`

## Responsibility

Returns the normalized catalog payload used by the booking editor for the active or requested price list.

## Functions

| Function | Description |
| --- | --- |
| `centsToNokString` | Converts cent values into whole-number NOK strings for API responses. |
| `toDateInputValue` | Formats a `Date` into the `YYYY-MM-DD` string expected by the booking UI. |
| `GET` | Authenticates the caller, resolves the effective price list, normalizes product config, and returns catalog products plus special options. It now includes `allowModelNumber` in each product payload. |
