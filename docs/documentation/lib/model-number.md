# Model Number

## Source

- `lib/products/modelNumber.ts`

## Responsibility

Decides whether a product card shows the "Model number" input. Without delivery types, the product-level `allowModelNumber` flag decides. With delivery types on, only the selected (enabled) delivery type's `allowModelNumber` flag decides, because Edit Prices hides the product-level checkbox in that mode. Used by the dashboard `ProductCard` and the price breakdown in `fromProductCards.ts`.

## Functions

| Function | Description |
| --- | --- |
| `isModelNumberEnabled(product, deliveryType)` | `true` when the model number input should be shown for this product + delivery type. |
