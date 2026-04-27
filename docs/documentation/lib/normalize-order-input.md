# Normalize Order Input

## Source

- `lib/orders/normalizeOrderInput.ts`

## Responsibility

Normalizes mixed request-body values before order create and update routes persist them.

## Functions

| Function | Description |
| --- | --- |
| `optionalString` | Returns a trimmed string or `undefined` for empty and non-string values. |
| `optionalBoolean` | Returns `true` only when the submitted value is the boolean `true`. |
| `safeInteger` | Converts numeric or string input into a non-negative integer with invalid values falling back to `0`. |
| `safeNumber` | Returns a finite number or `0` for invalid values. |
