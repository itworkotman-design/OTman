# Address Autocomplete Input

## Source

- `app/_components/Dahsboard/booking/create/AddressAutocompleteInput.tsx`

## Responsibility

Renders the shared address input used in booking, site, and user-management flows. It queries the internal address-search API, shows business or address suggestions, and writes the selected address back into the field.

## Functions

| Function | Description |
| --- | --- |
| `AddressAutocompleteInput` | Main React component for the shared autocomplete input. Manages query state, loading state, dropdown visibility, selection behavior, and an optional `inputId` used by the booking editor for scroll-to-error targeting. |
| `getSessionToken` | Creates and reuses a Mapbox Search Box session token for the current autocomplete interaction so related requests stay grouped together. |
| `selectSuggestion` | Applies a selected result to the field, closes the dropdown, resets the active search session, and blurs the input so a new search does not start immediately. |

## Behavioral Notes

- Typing fewer than 3 characters does not trigger a search.
- The dropdown shows a main line (`name`) and a secondary line (`subtitle`).
- Selecting a result inserts the normalized `label` returned by the API, which stays address-like even when the suggestion came from a business name search.
- Parent value sync only resets the interaction state on true external clears or resets, so normal typing does not cancel the pending autocomplete request.
- Pressing `Enter` while suggestions are open selects the first visible suggestion and closes the current search session.
