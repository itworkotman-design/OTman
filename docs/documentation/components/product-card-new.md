# Product Card New

## Source

- `app/_components/Dahsboard/booking/create/ProductCard.tsx`

## Responsibility

Renders one expandable booking product card and shows only the sections supported by the selected catalog product. Imported cards keep install and return sections visible when they already carry saved selections, even if the current delivery type is blank.

## Functions

| Function | Description |
| --- | --- |
| `ProductCardNew` | Main product-card component. It renders the product-specific fields, keeps imported install and return selections visible, and renders an optional `Model number` input when the selected product has `allowModelNumber` enabled. |
| `update` | Applies a partial change to the current saved product card and forwards it to the parent editor. |
| `handleProductSelect` | Resets product-specific state when the selected product changes, including clearing the card-level `modelNumber`. |
| `toggleOption` | Toggles install or extra option selections on the product card. |
| `getSelectedCustomSectionOptionIds` | Returns the selected option ids for one custom product section. |
| `toggleCustomSectionOption` | Updates the selected values for a custom product section. |
