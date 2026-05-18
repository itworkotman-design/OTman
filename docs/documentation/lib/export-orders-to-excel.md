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
| `exportOrdersToExcel` | Exports only the selected archive rows, used by admin bulk actions plus subcontractor and order-creator selected-row downloads. |
| `exportVisibleOrdersToExcel` | Exports every currently loaded visible archive row for callers that need a non-selected export. |
