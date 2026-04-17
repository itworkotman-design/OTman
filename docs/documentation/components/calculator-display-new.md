# Calculator Display New

## Source

- `app/_components/Dahsboard/booking/create/CalculatorDisplayNew.tsx`

## Responsibility

Displays the live booking price breakdown and totals for the selected product cards.

## Functions

| Function | Description |
| --- | --- |
| `formatNOK` | Formats a numeric total as a `NOK` string with two decimals. |
| `formatQty` | Formats a quantity for display, keeping half steps when needed. |
| `CalculatorDisplayNew` | Main calculator display component. It now renders a saved product-card `modelNumber` in muted gray parentheses beside the product heading when one exists. |
