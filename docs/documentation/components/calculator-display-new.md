# Calculator Display New

## Source

- `app/_components/Dahsboard/booking/create/CalculatorDisplay.tsx`

## Responsibility

Displays the booking price breakdown and totals for the selected product cards. Existing orders can force stored customer and subcontractor totals so saved snapshots remain price-frozen while the editor compares against current catalog prices separately. The calculator localizes built-in labels from `locale`, renders applied discount and extra rows above `Total`, renders read-only WordPress mismatch groups in gray with their import comment, keeps negative totals visible when admin adjustments exceed the subtotal, shows product and adjustment rows as whole kroner, and keeps `Total`, `VAT`, and `Total incl. VAT` at two decimals using the summary formatter.

## Functions

| Function | Description |
| --- | --- |
| `formatNOK` | Formats product and adjustment rows as whole-kroner `NOK` strings without decimal places. |
| `formatSumNOK` | Formats summary totals with two decimals for the calculator footer rows. |
| `formatQty` | Formats a quantity for display, keeping half steps when needed. |
| `CalculatorDisplayNew` | Main calculator display component. It renders a saved product-card `modelNumber` in muted gray parentheses beside the product heading when one exists, can force stored customer and subcontractor totals for frozen existing orders, shows read-only WordPress mismatch groups in gray, shows applied customer discount and extra rows above the total, exposes localized manual adjustment inputs for native admin edits, and leaves negative totals visible instead of hiding them. |
