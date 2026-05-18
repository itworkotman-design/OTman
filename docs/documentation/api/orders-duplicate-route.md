# Orders Duplicate Route

## Source

- `app/api/orders/duplicate/route.ts`

## Responsibility

Duplicates existing orders into new draft orders while preserving the source order's saved booking state, including native manual adjustments and hardcoded fee fields. Duplicated orders are manual app-created orders: they clear `legacyWordpressOrderId` and reserve a fresh internal `orderNumber` from the shared `20000` sequence instead of carrying over the source order number.

## Functions

| Function | Description |
| --- | --- |
| `POST` | Duplicates the requested orders, resets them to draft status, reserves a fresh manual `orderNumber`, preserves saved product-card data, and carries over manual adjustments, hardcoded fee fields, and custom-time contact fields such as `Contact customer?` and the optional contact note. |
