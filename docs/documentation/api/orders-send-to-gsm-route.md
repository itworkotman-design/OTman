# Orders Send To GSM Route

## Source

- `app/api/orders/send-to-gsm/route.ts`

## Responsibility

Validates the caller, loads the selected orders with their `items`, sends them to GSM while keeping OTman GSM ids and task references in sync, and writes successful GSM sends into order history plus last-edited metadata.

## Functions

| Function | Description |
| --- | --- |
| `POST` | Validates access, skips already-synced orders unless `force` is enabled, loads each order with `items`, sends it to GSM, persists the returned GSM order/task ids, updates last-edited metadata, and writes a GSM send action into order history. |
