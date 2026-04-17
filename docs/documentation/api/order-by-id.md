# Order By Id API

## Source

- `app/api/orders/[orderId]/route.ts`

## Responsibility

Reads and updates a single order, including product-card snapshots, event snapshots, and order-item rebuilding.

## Functions

| Function | Description |
| --- | --- |
| `formatList` | Formats a list of strings for readable order-event output. |
| `buildOptionLookup` | Builds a lookup map for product, option, and custom-section labels used in order-event diffs. |
| `describeCustomSelections` | Formats custom-section selections for order-event output. |
| `getProductCardValues` | Builds the labeled values used when comparing product-card changes between order revisions. It now includes the per-card `Model number` value. |
| `diffProductCards` | Compares previous and next product-card arrays and produces order-event change records. |
| `GET` | Loads one order and normalizes its saved product-card snapshot back into booking-editor state. It also returns the saved custom-time `Contact customer?` flag and contact note so the form can restore them. |
| `PATCH` | Updates the order, rebuilds summaries/items from product cards, writes order events, preserves the normalized product-card snapshot, and saves the custom-time `Contact customer?` flag plus its optional contact note. |
