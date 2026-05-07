# Pricing Snapshot

## Source

- `lib/booking/pricing/snapshot.ts`

## Responsibility

Builds, applies, and compares frozen order pricing snapshots so saved orders keep their original selected product, selected option, discount, delivery, and extra-charge prices until a user chooses to refresh them. Price comparison normalizes price fields to cents so equivalent formats such as `250`, `250.00`, and `25000` do not trigger false price-change warnings.

## Functions

| Function | Description |
| --- | --- |
| `buildOrderPricingSnapshot` | Captures the prices relevant to the selected product cards from the current catalog and price-list settings. |
| `applyOrderPricingSnapshot` | Overlays saved prices onto a loaded catalog and price-list settings object. |
| `getSavedOrderPricingSnapshot` | Reads the first saved pricing snapshot from a product-card array. |
| `pricingSnapshotsEqual` | Compares two pricing snapshots with stable key ordering, cents-normalized prices, and current selected snapshot keys so unselected saved option prices do not trigger warnings. |
