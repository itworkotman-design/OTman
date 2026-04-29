# WordPress Extra Pickup Backfill

## Source

- `scripts/backfill-wordpress-extra-pickups.ts`

## Responsibility

Backfills existing WordPress-imported orders that still have extra pickup data only inside `legacyWordpressRawMeta`. The script keeps raw WordPress meta for audit/debug use, but writes normalized `extraPickupAddress` and `extraPickupContacts` so archive queries do not need to select or parse raw meta.

## Functions

| Function | Description |
| --- | --- |
| `hasStoredContacts` | Checks whether an existing `extraPickupContacts` JSON value already contains contact rows. |
| `main` | Scans WordPress-imported orders in batches, extracts normalized extra pickup data from raw meta when needed, updates missing structured columns, logs per-order failures, and prints a final count. |

## Command

- `npm run backfill:wordpress-extra-pickups`
