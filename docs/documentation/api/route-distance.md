# Route Distance Route

## Source

- `app/api/route-distance/route.ts`

## Responsibility

Calculates the ordered driving distance for pickup, extra pickups, delivery, and return addresses for authenticated users by delegating to the Mapbox route-distance helper.

## Functions

| Function | Description |
| --- | --- |
| `toOptionalString` | Normalizes unknown request values to strings for single-address fields. |
| `toStringArray` | Filters the extra-pickup input down to a string array. |
| `POST` | Validates the session, normalizes the request body, calculates the Mapbox route distance, and returns the computed kilometer string and ordered stops. |
