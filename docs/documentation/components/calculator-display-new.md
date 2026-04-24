# Calculator Display New

## Source

- `app/_components/Dahsboard/booking/create/CalculatorDisplay.tsx`

## Responsibility

Displays the live booking price breakdown and totals for the selected product cards. The calculator renders applied `Rabatt` and `Ekstra` rows above `Total`, keeps negative totals visible when admin adjustments exceed the subtotal, shows product and adjustment rows as whole kroner, and keeps `Total`, `VAT`, and `Total incl. VAT` at two decimals using the summary formatter.

## Functions

| Function | Description |
| --- | --- |
| `formatNOK` | Formats product and adjustment rows as whole-kroner `NOK` strings without decimal places. |
| `formatSumNOK` | Formats summary totals with two decimals for the calculator footer rows. |
| `formatQty` | Formats a quantity for display, keeping half steps when needed. |
| `CalculatorDisplayNew` | Main calculator display component. It renders a saved product-card `modelNumber` in muted gray parentheses beside the product heading when one exists, shows applied customer discount and extra rows above the total, and leaves negative totals visible instead of hiding them. |
