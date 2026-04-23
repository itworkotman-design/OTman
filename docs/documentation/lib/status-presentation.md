# Status Presentation

## Source

- `lib/orders/statusPresentation.ts`

## Responsibility

Provides the shared order-status normalization and presentation helpers used by archive tables, API responses, and editor hydration. The helper keeps legacy imported values such as `fail` aligned with the canonical app status `failed`.

## Functions

| Function | Description |
| --- | --- |
| `normalizeOrderStatus` | Maps legacy or localized order-status values onto the app's canonical lowercase status keys. |
| `getOrderStatusStyle` | Returns the badge colors used for a normalized order status. |
| `getOrderStatusLabel` | Returns the normalized status label used in archive cells and other status displays. |
