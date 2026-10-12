# Order Drivers Route

## Source

- `app/api/orders/drivers/route.ts`

## Responsibility

Returns the canonical driver options from `lib/orders/knownDrivers.ts` after confirming that the requester has an active company membership. The fixed list keeps the filter stable regardless of spelling variations in stored orders; the filter exposes blank, zero, and dash-only values through its separate `No driver` option.

## Functions

| Function | Description |
| --- | --- |
| `GET` | Authenticates the active company membership and returns the configured driver ids and labels. |
