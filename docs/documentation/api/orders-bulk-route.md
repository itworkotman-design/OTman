# Orders Bulk Route

## Source

- `app/api/orders/bulk/route.ts`

## Responsibility

Applies bulk updates to orders for the active company and records the matching order events for those changes, preserving hardcoded fee fields in the event snapshots and clearing cancelled adjustment fields for orders moved out of `cancelled`.

## Functions

| Function | Description |
| --- | --- |
| `shouldClearCancelledDiscount` | Returns true when an order moves from `cancelled` to any other normalized status so cancelled adjustment fields can be removed. |
| `PATCH` | Validates the session and bulk payload, updates matching orders, clears `rabatt` and `subcontractorMinus` for orders moving from `cancelled` to a non-cancelled status, and creates either status-changed events or generic order-updated events based on the diff for each order. |
