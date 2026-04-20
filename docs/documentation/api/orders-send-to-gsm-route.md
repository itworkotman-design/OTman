# Orders Send To GSM Route

## Source

- `app/api/orders/send-to-gsm/route.ts`

## Responsibility

Validates the caller, loads the selected orders with their `items`, and sends them to GSM while keeping OTman GSM ids and task references in sync.

## Functions

| Function | Description |
| --- | --- |
| `POST` | Validates access, skips already-synced orders unless `force` is enabled, loads each order with `items`, sends it to GSM, and persists the returned GSM order/task ids. |
