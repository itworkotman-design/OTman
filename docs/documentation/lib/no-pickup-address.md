# No Pickup Address

## Source

- `lib/orders/noPickupAddress.ts`

## Responsibility

Defines the "No shop pickup address" placeholder stored on orders that need no shop pickup (install-only / return-only, or an admin removed the pickup) and the rule that such an order must never carry a saved pickup location. Shared by the booking editor and the order create/update APIs so a stale saved-location id can't re-fill the address and send the driver to that store via GSM.

## Functions

| Function | Description |
| --- | --- |
| `isNoPickupAddress` | True for blank/missing values and the `No shop pickup address` placeholder (case- and padding-insensitive). |
| `resolvePickupForSubmit` | Builds the pickup fields the order form submits: forces the placeholder when the pickup is locked, and drops the saved-location id and coordinates whenever the result is "no pickup". |
| `restorePickupAfterUnlock` | Picks the address to show when a locked pickup unlocks again: the address entered before the lock, else the customer's address. Never returns the placeholder itself. |
