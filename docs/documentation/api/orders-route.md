# Orders Route

## Source

- `app/api/orders/route.ts`

## Responsibility

Creates new orders and lists company orders. During order creation it copies pending files into permanent order attachments while preserving the selected category, validates extra pickup contacts, applies saved product-card pricing snapshots with the selected price list's global settings before building summaries/items, persists native manual adjustment and hardcoded fee fields, creates an order-level alert when extra pickups are present, and skips outbound order-notification emails when the active company's `orderEmailsEnabled` flag is disabled. Warehouse-email copies are no longer sent from the create-order flow. The order list response also carries the derived mail-alert and notification-alert fields used by the admin archive alert cell, plus the grouped product summary data used by the archive `Produkter` column. Order-creator archive queries now include orders where the active membership is either the customer owner or the original creator, which makes imported WordPress orders visible without a data backfill. The archive `Store` value and store filter use the assigned `customerMembershipId` membership/user, so changing the store in the order modal updates both the table and store filtering without confusing store with customer name or label. Status filtering also normalizes legacy `fail` rows so the `failed` filter matches both old and canonical values, archive rows use normalized extra-pickup columns instead of reading `legacyWordpressRawMeta`, product summaries keep item `rawData` so custom/install descriptions remain visible, and archive text search ignores letter case and spaces for names, emails, phone numbers, ids, addresses, summaries, and notes.

## Functions

| Function | Description |
| --- | --- |
| `parsePositiveInt` | Parses a positive integer from query-string input with a fallback. |
| `orderMatchesSearch` | Checks an order against the normalized archive search query across searchable text, number, email, phone, assigned store, and creator fields. |
| `reserveNextOrderNumber` | Reserves the next company-specific display id for a new order. |
| `POST` | Creates a new order, validates that each extra pickup has either a valid phone or a valid email, applies the submitted pricing snapshot before building summaries and item rows, persists native manual adjustments plus hardcoded fee flags/minutes, transfers pending files into permanent attachments, creates an extra-pickup order notification when needed, stores the custom-time `Contact customer?` flag plus its optional contact note when present, suppresses outbound order emails when company email sending is disabled, and no longer sends warehouse-email copies from this flow. |
| `GET` | Returns filtered and paginated order rows for the active company, including both unread mail attention data and unresolved notification attention data for the admin alert cell, along with `orderSummaryGroups` and `orderSummaryText` built from item rows with `rawData` descriptions and a legacy summary fallback for older orders. For order creators it matches rows where the active membership is the assigned store or the stored creator so imported WordPress orders show up in the same archive, maps the archive store label to the assigned membership user, filters the store dropdown against `customerMembershipId`, normalizes legacy `fail` rows in both the response payload and the `failed` archive filter, reads normalized extra-pickup columns without selecting `legacyWordpressRawMeta`, applies a database prefilter for archive search to reduce the candidate set before the normalized in-memory search fallback runs, caps `rowsPerPage` at `200`, and then returns the requested page. |
