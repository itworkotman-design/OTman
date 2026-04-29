# Order History Route

## Source

- `app/api/orders/[orderId]/history/route.ts`

## Responsibility

Returns and rebuilds order history entries for a single order, including normalized event snapshots with hardcoded fee fields.

## Functions

| Function | Description |
| --- | --- |
| `parsePayload` | Narrows stored event payload JSON into the supported created, updated, action, or status-changed shapes. |
| `GET` | Loads order history events for the active company order and falls back to a generated created-order snapshot when no stored events exist. |
