# Build Archive Calculator Items

## Source

- `lib/orders/buildArchiveCalculatorItems.ts`

## Responsibility

Builds saved calculator lines for archive/read-only order modals from persisted `OrderItem` rows and `productCardsSnapshot`. It preserves product codes, descriptions, customer prices, and subcontractor prices for order creators and subcontractors, replaces usable WordPress unmatched snapshots with clean read-only price rows instead of importer warning text, and falls back to persisted item rows when a WordPress snapshot has no usable price rows.

## Functions

| Function | Description |
| --- | --- |
| `normalizeItemType` | Maps persisted item type strings into the calculator item type set. |
| `getProductModelNumber` | Reads a saved product model number from item raw data when present. |
| `getRawString` | Reads a trimmed string field from an item raw-data object. |
| `toArchiveCalculatorItem` | Converts one persisted order item into the read-only calculator item shape. |
| `findMatchingWordpressSubcontractorRow` | Matches a WordPress customer price row to the corresponding subcontractor row. |
| `buildWordpressReadOnlyItems` | Converts a WordPress unmatched snapshot into clean product and price rows for read-only display, returning no override when the snapshot has no priced rows. |
| `normalizeProductCardsSnapshot` | Normalizes the saved product-card snapshot array before WordPress read-only checks. |
| `buildArchiveCalculatorItems` | Combines persisted order items with WordPress read-only snapshot overrides in stable card order. |
