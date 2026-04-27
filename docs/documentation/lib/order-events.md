# Order Events

## Source

- `lib/orders/orderEvents.ts`

## Responsibility

Builds normalized order snapshots and change descriptions for order history entries, including order-level fee changes.

## Functions

| Function | Description |
| --- | --- |
| `normalizeString` | Normalizes mixed input into a comparable string or `null` for event snapshots. |
| `normalizeBoolean` | Normalizes mixed input into a strict boolean for event snapshots. |
| `normalizeStringArray` | Normalizes array-like string input into trimmed comparable arrays. |
| `formatBooleanValue` | Formats boolean values into user-facing change text. |
| `formatValue` | Converts snapshot values into readable event text. |
| `buildOrderEventSnapshot` | Creates a normalized order snapshot used for history diffs. It now includes the custom-time `Contact customer?` flag, optional contact note, and extra-work fee minutes. |
| `diffOrderEventSnapshots` | Compares two snapshots and returns the changed fields for history events. |
| `createOrderCreatedEvent` | Writes the initial order-created history entry. |
| `createOrderUpdatedEvent` | Writes a standard order-updated history entry. |
| `createOrderStatusChangedEvent` | Writes a status-changed history entry with old and new status values. |
