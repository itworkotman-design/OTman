# Product Card Types

## Source

- `app/_components/Dahsboard/booking/create/_types/productCard.ts`

## Responsibility

Defines the saved product-card shape used across booking, plus the helpers that create and normalize product-card data.

## Functions

| Function | Description |
| --- | --- |
| `createEmptyProductCard` | Creates the default saved card state for a new product row, including an empty optional `modelNumber`. |
| `normalizeSavedProductCard` | Normalizes persisted or partial product-card data into a full `SavedProductCard`. It now restores `modelNumber` and keeps legacy snapshots compatible. |
