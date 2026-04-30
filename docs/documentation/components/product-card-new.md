# Product Card New

## Source

- `app/_components/Dahsboard/booking/create/ProductCard.tsx`

## Responsibility

Renders one expandable booking product card and shows only the sections supported by the selected catalog product. Products with delivery types enabled default to `INDOOR` when selected or when an empty/invalid saved delivery type is loaded, so the card cannot stay on the `Velg` placeholder. `RETURN_ONLY` delivery cards automatically select the first available return option when none is selected and prevent clearing the last selected return radio. Imported cards keep install and return sections visible when they already carry saved selections, even if the current delivery type is blank or not a native return-only mode, the return selector supports clearing an already selected return option without changing delivery type first, and WordPress price mismatches render as gray read-only cards with saved row quantities and line totals.

## Functions

| Function | Description |
| --- | --- |
| `formatQuantity` | Formats saved WordPress row quantities for read-only mismatch display. |
| `getDefaultDeliveryType` | Returns the default delivery type for a product, preferring `INDOOR` and falling back to the first configured delivery type. |
| `getDefaultReturnOptionId` | Returns the first available active return option id for `RETURN_ONLY` delivery cards. |
| `ProductCardNew` | Main product-card component. It renders product-specific fields for editable native cards, defaults delivery-enabled products away from the `Velg` placeholder, requires a return radio for `RETURN_ONLY`, renders WordPress price mismatches as read-only gray cards with the import comment, saved row quantities, and line totals, keeps imported install and return selections visible, allows an already selected return option to be cleared in place outside `RETURN_ONLY`, and renders an optional `Model number` input when the selected product has `allowModelNumber` enabled. |
| `update` | Applies a partial change to the current saved product card and forwards it to the parent editor. |
| `handleProductSelect` | Resets product-specific state when the selected product changes, including clearing the card-level `modelNumber` and applying the default delivery type when the product supports delivery types. |
| `toggleOption` | Toggles install or extra option selections on the product card. |
| `toggleReturnOption` | Toggles the single selected return option on or off, except for `RETURN_ONLY` cards where the selected option cannot be cleared. |
| `getSelectedCustomSectionOptionIds` | Returns the selected option ids for one custom product section. |
| `toggleCustomSectionOption` | Updates the selected values for a custom product section. |
