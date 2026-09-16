# Address Search Retrieve Route

## Source

- `app/api/address-search/retrieve/route.ts`

## Responsibility

Companion to `GET /api/address-search`: Mapbox's Search Box `/suggest` endpoint (used there) never returns coordinates, only a follow-up `/retrieve/{mapbox_id}` call against the same session token does. Called by `AddressAutocompleteInput`/`PickupAddressCombobox` right after a suggestion is selected, so the client can learn where the picked address actually is and pass it along as `AddressSelectionMeta.latitude`/`longitude` — ultimately so order routes can store a real coordinate for a manually-found pickup/delivery/return address instead of leaving GSM to geocode the address text on its own.

## Functions

| Function | Description |
| --- | --- |
| `parseCoordinatePair` | Reads a `[longitude, latitude]` pair out of Mapbox's response geometry, rejecting anything that isn't exactly that shape. |
| `GET` | Handles `GET /api/address-search/retrieve`. Validates `id`, calls Mapbox Search Box `/retrieve/{id}`, and returns the resolved coordinate. |

## Response Shape

| Field | Description |
| --- | --- |
| `ok` | `true` on success. |
| `latitude` / `longitude` | The resolved coordinate for the suggestion id. |
| `reason` | Present on failure — `ID_REQUIRED`, `MAPBOX_ACCESS_TOKEN_MISSING`, or `ADDRESS_RETRIEVE_FAILED`. |
