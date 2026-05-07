# Export Orders To Excel

## Source

- `lib/booking/exportOrdersToExcel.ts`

## Responsibility

Builds styled Excel workbooks for booking archive exports using the same column metadata as the visible archive table. Price columns are exported as right-aligned numeric cells without `NOK` text so Excel sums work.

## Functions

| Function | Description |
| --- | --- |
| `isRightAlignedColumn` | Checks whether an exported column should use right alignment and numeric formatting. |
| `writeOrdersWorkbook` | Creates the shared styled workbook and saves it with the provided filename. |
| `exportOrdersToExcel` | Exports only the selected archive rows, used by the admin selection action bar. |
| `exportVisibleOrdersToExcel` | Exports every currently loaded visible archive row, used by the order-creator table download. |
