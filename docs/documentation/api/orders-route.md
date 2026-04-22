# Orders Route

## Source

- `app/api/orders/route.ts`

## Responsibility

Creates new orders and lists company orders. During order creation it copies pending files into permanent order attachments while preserving the selected category, validates extra pickup contacts, creates an order-level alert when extra pickups are present, and skips outbound order-notification emails when the active company's `orderEmailsEnabled` flag is disabled. The order list response also carries the derived mail-alert and notification-alert fields used by the admin archive alert cell, plus the grouped product summary data used by the archive `Produkter` column. Order-creator archive queries now include orders where the active membership is either the customer owner or the original creator, which makes imported WordPress orders visible without a data backfill.

## Functions

| Function | Description |
| --- | --- |
| `parsePositiveInt` | Parses a positive integer from query-string input with a fallback. |
| `reserveNextOrderNumber` | Reserves the next company-specific display id for a new order. |
| `POST` | Creates a new order, validates that each extra pickup has either a valid phone or a valid email, normalizes stored extra-pickup contacts, builds related summaries and items, transfers pending files into permanent attachments, creates an extra-pickup order notification when needed, stores the custom-time `Contact customer?` flag plus its optional contact note when present, and suppresses outbound order emails when company email sending is disabled. |
| `GET` | Returns filtered and paginated order rows for the active company, including both unread mail attention data and unresolved notification attention data for the admin alert cell, along with `orderSummaryGroups` and `orderSummaryText` built from `items` with a legacy summary fallback for older orders. For order creators it matches rows where the active membership is the customer owner or the stored creator so imported WordPress orders show up in the same archive. |
