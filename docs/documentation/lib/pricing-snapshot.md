# Pricing Snapshot

## Source

- `lib/booking/pricing/snapshot.ts`

## Responsibility

Builds, applies, and compares frozen order pricing snapshots so saved orders keep their original product, discount, delivery, and extra-charge prices until a user chooses to refresh them.

## Functions

| Function | Description |
| --- | --- |
| `buildOrderPricingSnapshot` | Captures the prices relevant to the selected product cards from the current catalog and price-list settings. |
| `applyOrderPricingSnapshot` | Overlays saved prices onto a loaded catalog and price-list settings object. |
| `getSavedOrderPricingSnapshot` | Reads the first saved pricing snapshot from a product-card array. |
| `pricingSnapshotsEqual` | Compares two pricing snapshots with stable key ordering. |
