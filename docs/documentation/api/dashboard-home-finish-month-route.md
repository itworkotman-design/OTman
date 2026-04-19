# Dashboard Home Finish Month Route

## Source

- `app/api/dashboard/home/finish-month/route.ts`

## Responsibility

Runs the manual month-end subcontractor summary job from the dashboard quick-tasks UI.

## Functions

| Function | Description |
| --- | --- |
| `getMonthRange` | Returns the current month’s inclusive start and exclusive end timestamps for order filtering. |
| `getMonthLabel` | Formats the current month into a human-readable Norwegian month label for subjects and workbook metadata. |
| `formatCurrency` | Formats subcontractor monthly totals as Norwegian kroner strings for email content. |
| `buildFileName` | Creates the exported workbook filename for each subcontractor summary. |
| `POST` | Validates that the caller is an active owner or admin, groups current-month orders by subcontractor, builds one Excel workbook per subcontractor, emails each workbook separately, and skips subcontractors with no new orders in the current month. |
