# Orders Duplicate Route

## Source

- `app/api/orders/duplicate/route.ts`

## Responsibility

Duplicates existing orders into new draft orders while preserving the source order's saved booking state, including native manual adjustments and hardcoded fee fields.

## Functions

| Function | Description |
| --- | --- |
| `reserveNextOrderNumber` | Reserves the next company-specific display id for each duplicated order. |
| `POST` | Duplicates the requested orders, resets them to draft status, preserves saved product-card data, and carries over manual adjustments, hardcoded fee fields, and custom-time contact fields such as `Contact customer?` and the optional contact note. |
