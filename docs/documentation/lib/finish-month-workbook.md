# Finish Month Workbook

## Source

- `lib/dashboard/finishMonthWorkbook.ts`

## Responsibility

Builds the Excel workbook attached to each subcontractor month-end summary email.

## Functions

| Function | Description |
| --- | --- |
| `formatDateTime` | Formats order creation timestamps into Norwegian date-time strings for workbook rows. |
| `formatText` | Normalizes optional workbook values into either trimmed text or `-`. |
| `buildFinishMonthWorkbook` | Creates the monthly subcontractor workbook with top-level `Month sum`, subcontractor metadata, and one order row per order using subcontractor pricing totals. The header row is now written cell-by-cell so column A starts with the first real header instead of an empty placeholder cell. |
