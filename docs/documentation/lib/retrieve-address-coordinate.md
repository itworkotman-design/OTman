# Retrieve Address Coordinate

## Source

- `lib/orders/retrieveAddressCoordinate.ts`

## Responsibility

Client-side helper that calls `GET /api/address-search/retrieve` right after a Mapbox Search Box suggestion is selected (in `AddressAutocompleteInput` and `PickupAddressCombobox`), since Mapbox's `/suggest` results never carry a coordinate. Never throws — a failed lookup just means the caller backfills no coordinate for that pick, and the address text itself was already committed regardless.

## Functions

| Function | Description |
| --- | --- |
| `retrieveAddressCoordinate` | Fetches the coordinate for a Mapbox suggestion id/session token pair, returning `null` on any failure (missing session token, network error, non-ok response). |
