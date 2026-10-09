# Order By Id API

## Source

- `app/api/orders/[orderId]/route.ts`

## Responsibility

Reads and updates a single order, including product-card pricing snapshots, selected price-list global settings, event snapshots, order-item rebuilding, native manual adjustments, owner/admin DNB discount state, hardcoded fee fields, cancelled-status adjustment cleanup, and centralized alert rules from `lib/orders/alerts`. The read path preserves saved return selections as stored and rebuilds missing legacy WordPress extra pickups from `legacyWordpressRawMeta` when older imports never populated the structured extra-pickup fields.

## Functions

| Function | Description |
| --- | --- |
| `formatList` | Formats a list of strings for readable order-event output. |
| `buildOptionLookup` | Builds a lookup map for product, option, and custom-section labels used in order-event diffs. |
| `describeCustomSelections` | Formats custom-section selections for order-event output. |
| `getProductCardValues` | Builds the labeled values used when comparing product-card changes between order revisions. It now includes the per-card `Model number` value. |
| `diffProductCards` | Compares previous and next product-card arrays and produces order-event change records. |
| `shouldClearCancelledDiscount` | Returns true when an order moves from `cancelled` to any other normalized status so cancelled adjustment fields can be removed. |
| `GET` | Loads one order and normalizes its saved product-card snapshot back into booking-editor state. It also returns the saved DNB discount flag, hardcoded fee fields, custom-time `Contact customer?` flag, contact note, and return address so the form can restore them, and it falls back to legacy WordPress raw meta to rebuild extra pickup rows when older imports are missing structured extra-pickup contacts. |
| `PATCH` | Updates the order, validates and normalizes extra-pickup contacts, applies saved pricing snapshots with the selected price list's global settings before rebuilding summaries/items from product cards, clears `rabatt` and `subcontractorMinus` when status changes from `cancelled` to another status, preserves stored customer and subcontractor base prices, persists native manual adjustments, owner/admin-submitted DNB discount state, and hardcoded fee fields, writes order events, runs the centralized alert rules, preserves the normalized product-card snapshot, and saves the custom-time `Contact customer?` flag plus its optional contact note. It also persists edited return addresses. On a website order, a status *change* to anything outside `WEBSITE_ORDER_STATUS_OPTIONS` is refused (`WEBSITE_ORDER_STATUS_NOT_ALLOWED`); an unchanged legacy status such as `approved` still saves. |

## White-goods website orders (PATCH)

An order with `websiteOrderKind === "WHITE_GOODS"` (a homepage order) is re-priced from the merged website catalog (`getWebsiteOrderCatalog`), the same one it was booked from. It is not re-priced from its single `priceListId`, because that only covers the first website list, so products from the others would be dropped or mispriced. Every other order keeps using its own price list.
