# Orders Route

## Source

- `app/api/orders/route.ts`

## Responsibility

Creates new orders and lists company orders. During order creation it now copies pending files into permanent order attachments while preserving the selected category.

## Functions

| Function | Description |
| --- | --- |
| `parsePositiveInt` | Parses a positive integer from query-string input with a fallback. |
| `reserveNextOrderNumber` | Reserves the next company-specific display id for a new order. |
| `POST` | Creates a new order, builds related summaries/items, transfers pending files into permanent attachments, preserves each file category, and stores the custom-time `Contact customer?` flag plus its optional contact note when present. |
| `GET` | Returns filtered and paginated order rows for the active company. |
