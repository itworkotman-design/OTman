# Order Summary

## Source

- `lib/orders/orderSummary.ts`

## Responsibility

Builds the compact grouped product summary used by the archive table export and the GSM description. The summary builder accepts the lightweight archive item shape and only uses `rawData` when it is present.

## Functions

| Function | Description |
| --- | --- |
| `buildOrderSummaryGroups` | Groups `OrderItem` rows by `cardId` and returns one title-plus-details block per product card. |
| `buildLegacyOrderSummaryGroups` | Creates a fallback grouped summary from the legacy stored summary strings when an order has no `items` rows. |
| `formatOrderSummaryText` | Converts grouped summary blocks into a newline-delimited text format for export and GSM descriptions. |
