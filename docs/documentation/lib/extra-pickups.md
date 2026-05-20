# Extra Pickups

## Source

- `lib/orders/extraPickups.ts`

## Responsibility

Holds the shared parsing, validation, normalization, and default-value helpers for extra pickup contacts so the booking UI and order APIs enforce the same rules. Extra pickup phone and email values are optional, but malformed provided values are still rejected.

## Functions

| Function | Description |
| --- | --- |
| `createEmptyExtraPickup` | Returns the default extra-pickup draft with blank optional contact fields and enabled `sendEmail` flag. |
| `parseExtraPickups` | Reads raw request or JSON-stored extra-pickup data, trims its values, and drops entries without an address. |
| `getExtraPickupValidation` | Computes field-level phone/email validation for one extra pickup without requiring either contact method. |
| `normalizeExtraPickups` | Normalizes each extra pickup for persistence by trimming addresses, lowercasing emails, and compacting phone numbers. |
| `getExtraPickupApiError` | Returns the first API-safe validation message for malformed extra pickup phone/email values. |
