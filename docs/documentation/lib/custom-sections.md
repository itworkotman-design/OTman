# Custom Sections

## Source

- `lib/products/customSections.ts`

## Responsibility

Normalizes product custom-section configuration stored on products, including option rows and the delivery types that decide when each section is visible in booking.

## Functions

| Function | Description |
| --- | --- |
| `toNonEmptyString` | Converts unknown values into trimmed strings or an empty string. |
| `toPriceString` | Normalizes custom option prices into non-negative string values. |
| `createId` | Builds fallback ids for sections and options when stored data is missing ids. |
| `normalizeDisplayOnDeliveryTypes` | Normalizes section display toggles and defaults missing values to `INSTALL_ONLY`. |
| `isCustomSectionVisibleForDeliveryType` | Checks whether a custom section should show for a selected delivery type, hides it until a delivery type is selected, and always shows it when the product has no delivery-type selector. |
| `normalizeProductCustomSections` | Normalizes stored custom sections, options, pricing flags, multiple-selection flags, and display toggles. |
