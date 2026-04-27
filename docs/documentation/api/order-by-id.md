# Order By Id API

## Source

- `app/api/orders/[orderId]/route.ts`

## Responsibility

Reads and updates a single order, including product-card pricing snapshots, event snapshots, order-item rebuilding, native manual adjustments, and extra-pickup alert creation when extra pickups change. The read path now rebuilds missing legacy WordPress extra pickups from `legacyWordpressRawMeta` when older imports never populated the structured extra-pickup fields.

## Functions

| Function | Description |
| --- | --- |
| `formatList` | Formats a list of strings for readable order-event output. |
| `buildOptionLookup` | Builds a lookup map for product, option, and custom-section labels used in order-event diffs. |
| `describeCustomSelections` | Formats custom-section selections for order-event output. |
| `getProductCardValues` | Builds the labeled values used when comparing product-card changes between order revisions. It now includes the per-card `Model number` value. |
| `diffProductCards` | Compares previous and next product-card arrays and produces order-event change records. |
| `GET` | Loads one order and normalizes its saved product-card snapshot back into booking-editor state. It also returns the saved custom-time `Contact customer?` flag, contact note, and return address so the form can restore them, and it falls back to legacy WordPress raw meta to rebuild extra pickup rows when older imports are missing structured extra-pickup contacts. |
| `PATCH` | Updates the order, validates and normalizes extra-pickup contacts, applies saved pricing snapshots before rebuilding summaries/items from product cards, persists native manual adjustments, writes order events, creates a fresh extra-pickup order notification when the extra-pickup list changes, preserves the normalized product-card snapshot, and saves the custom-time `Contact customer?` flag plus its optional contact note. It also persists edited return addresses. |
