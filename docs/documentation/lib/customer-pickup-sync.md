# Customer Pickup Sync

## Source

- `lib/orders/customerPickupSync.ts`

## Responsibility

Decides whether the booking form overwrites the pickup address with the selected customer's default address. Protects a pickup the user entered by hand from being blanked by a customer without an address, while still clearing an auto-filled default on a customer switch.

## Functions

| Function | Description |
| --- | --- |
| `shouldApplyCustomerPickup` | Returns whether the customer's address should replace the current pickup, given whether this is the initial sync, whether the user edited the pickup, and the customer's address. |
