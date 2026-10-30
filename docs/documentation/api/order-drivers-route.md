# Order Drivers Route

## Source

- `app/api/orders/drivers/route.ts`

## Responsibility

Returns the drivers that actually appear on the active company's orders (the same scope as the admin order list), after confirming that the requester has an active admin or owner membership. Other memberships receive `403`. Options are built by `getDriverFilterOptions`: spelling variants collapse into the canonical drivers from `lib/orders/knownDrivers.ts`, multi-driver values are split, and names outside the known list are included with their label as id. Blank, zero, and dash-only values are left to the filter's separate `No driver` option.

## Functions

| Function | Description |
| --- | --- |
| `GET` | Authenticates an active admin or owner membership, reads the distinct `driver` values on the company's orders, and returns them as driver filter ids and labels. |
