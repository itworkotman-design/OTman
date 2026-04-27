# Product Card Types

## Source

- `app/_components/Dahsboard/booking/create/_types/productCard.ts`

## Responsibility

Defines the saved product-card shape used across booking, including the optional frozen pricing snapshot, optional read-only WordPress import price snapshot, plus the helpers that create and normalize product-card data.

## Functions

| Function | Description |
| --- | --- |
| `createEmptyProductCard` | Creates the default saved card state for a new product row, including an empty optional `modelNumber`, no pricing snapshot, and no WordPress read-only snapshot. |
| `normalizeSavedProductCard` | Normalizes persisted or partial product-card data into a full `SavedProductCard`. It restores `modelNumber`, preserves saved pricing snapshots, preserves WordPress read-only snapshots, and keeps legacy snapshots compatible. |
