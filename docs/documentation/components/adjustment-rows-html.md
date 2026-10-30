# Adjustment Rows HTML

## Source

- `app/_components/Dahsboard/booking/orders/adjustmentRowsHtml.ts`

## Responsibility

Builds the discount/extra (customer) or minus/plus (partner) rows for the printed order PDF, using the PDF's `.priceRow` styling and Norwegian labels (`Rabatt`, `Ekstra`, `Minus`, `Pluss`). Partners never get the customer's discount rows.

## Functions

| Function | Description |
| --- | --- |
| `renderAdjustmentRowsHtml` | Renders the viewer's adjustment lines as `<label> – <description> (<percent> %)  -500,00 NOK` rows; descriptions are HTML-escaped; returns an empty string when there are no lines. |