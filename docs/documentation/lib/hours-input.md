# Hours Input

## Source

- `lib/booking/hoursInput.ts`

## Responsibility

Shared rules for the labour "Hours input" on product cards: hours are billed in 15-minute increments (`HOURS_INPUT_STEP = 0.25`) with a 15-minute minimum. Used by the dashboard `ProductCard` input and by the server-side pricing/order builders (`fromProductCards.ts`, `buildOrderItemsFromCards.ts`) so client and server agree.

## Functions

| Function | Description |
| --- | --- |
| `normalizeHoursInput(value)` | Snaps to the nearest 0.25 h, minimum 0.25 h; non-numeric/NaN falls back to 1 h. |
| `sanitizeHoursInputDraft(text)` | Strips everything except digits and the first `.`/`,` — applied on every keystroke in the hours field. |
| `parseHoursInputDraft(text)` | Parses typed text (`"1.5"` or `"1,5"`); returns `null` when empty or invalid so the field can be cleared while editing. |
