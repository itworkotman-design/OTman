# Orders Bulk Route

## Source

- `app/api/orders/bulk/route.ts`

## Responsibility

Applies bulk updates to orders for the active company and records the matching order events for those changes.

## Functions

| Function | Description |
| --- | --- |
| `PATCH` | Validates the session and bulk payload, updates matching orders, and creates either status-changed events or generic order-updated events based on the diff for each order. |
