# Extra Pickups

## Source

- `lib/orders/extraPickups.ts`

## Responsibility

Holds the shared parsing, validation, normalization, and default-value helpers for extra pickup contacts so the booking UI and order APIs enforce the same rules.

## Functions

| Function | Description |
| --- | --- |
| `createEmptyExtraPickup` | Returns the default extra-pickup draft, including the `+47` phone prefix and enabled `sendEmail` flag. |
| `parseExtraPickups` | Reads raw request or JSON-stored extra-pickup data, trims its values, and drops entries without an address. |
| `getExtraPickupValidation` | Computes field-level phone/email validation plus the shared “phone or email required” state for one extra pickup. |
| `normalizeExtraPickups` | Normalizes each extra pickup for persistence by trimming addresses, lowercasing emails, and compacting phone numbers. |
| `getExtraPickupApiError` | Returns the first API-safe validation message for an invalid extra pickup, including missing-contact and malformed phone/email cases. |
