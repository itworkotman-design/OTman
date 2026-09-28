# Address Removal Access

## Source

- `lib/orders/addressRemovalAccess.ts`

## Responsibility

Server-side rule for the order create/update APIs: only OWNER/ADMIN may take a pickup or delivery address off an order, so a stray removal can't send a GSM driver to the wrong place or leave a task without a destination. Backs the admin-only Remove button in the booking form. The return address is excluded because it clears itself when the return option is deselected.

## Functions

| Function | Description |
| --- | --- |
| `isPickupLockedForCards` | True when every product card is install-only or return-only — the only case where a non-admin may submit the `No shop pickup address` placeholder. |
| `findForbiddenAddressRemoval` | Returns `pickupAddress` / `deliveryAddress` when a non-admin submits a blank (or unlocked placeholder) address; on an update it only counts if the stored order had that address. Admins are never blocked. |
