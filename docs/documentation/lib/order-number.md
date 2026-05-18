# Order Number Helpers

## Source

- `lib/orders/orderNumber.ts`

## Responsibility

Reserves internal manual app order numbers. Manual orders start at `20000`, store the reserved value as `orderNumber` and `displayId`, and skip numbers already present as either `displayId` or `orderNumber` on imported WordPress orders or other existing orders to avoid collisions.

## Functions

| Function | Description |
| --- | --- |
| `reserveNextManualOrderNumber` | Reserves the next unused numeric manual order number for a company and advances `CompanyOrderCounter.nextNumber`. |
