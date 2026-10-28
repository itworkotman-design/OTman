# Product Card Install Options

## Source

- `app/_components/Dahsboard/booking/create/_types/installOptions.ts`

## Responsibility

Decides which options a booking product card lists in its install section, and which install option starts out selected. A product with exactly one (active) install option gets it pre-selected when the product is picked, or when the delivery type changes to one that allows install options. The user can still untick it.

## Functions

| Function | Description |
| --- | --- |
| `hasCategorizedInstallOptions` | Whether the product has any option categorized as install. |
| `getProductInstallOptions` | Options shown in the install section: install-categorized options, or (for products without delivery types and no install-categorized options) the product's plain active options, shown as a "Choose" list. |
| `getDefaultInstallOptionIds` | `[id]` of the single install option when the product allows install options, the chosen delivery type (if the product uses them) allows install options, and exactly one active option is listed; otherwise `[]`. |
