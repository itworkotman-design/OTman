# Address Search Route

## Source

- `app/api/address-search/route.ts`

## Responsibility

Provides autocomplete suggestions for addresses, streets, and businesses by calling the Mapbox Search Box API and normalizing the response for the frontend input component.

## Functions

| Function | Description |
| --- | --- |
| `buildSuggestionSubtitle` | Builds the secondary line shown for a suggestion. For businesses, it prefers the full address. For non-business results, it uses the formatted place context. |
| `buildSuggestionLabel` | Builds the value written back into the form when a suggestion is selected. It prefers a full address-like string so downstream form fields still store addresses. |
| `GET` | Handles `GET /api/address-search`. Validates the query, sends a request to Mapbox Search Box `suggest`, and returns normalized suggestion objects for the UI. |

## Response Shape

| Field | Description |
| --- | --- |
| `id` | Mapbox result identifier. |
| `label` | Address-like value inserted into the input on selection. |
| `name` | Main display text for the dropdown item, such as a business name or address name. |
| `subtitle` | Secondary display text, usually address or place context. |
| `featureType` | Result type from Mapbox, such as `poi`, `address`, or `street`. |
