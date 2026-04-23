# Booking Archive Table

## Source

- `app/_components/Dahsboard/booking/archive/BookingArchiveTable.tsx`

## Responsibility

Renders the archive table for admin, subcontractor, and order-creator views using the active column configuration. The admin table now shows `Store` before `Customer name`, the admin customer column reads from the order's `customerName` field instead of the store label field, and the status badge now uses the shared status-normalization helper for both its visible label and hover title.

## Functions

| Function | Description |
| --- | --- |
| `formatCell` | Normalizes empty cell values into `-` for display. |
| `formatDateTime` | Formats ISO timestamps into Norwegian date-time strings for archive cells. |
| `formatMoney` | Formats numeric archive totals as `NOK` strings. |
| `formatStatusCell` | Wraps status text in the status-style badge used throughout the archive and normalizes legacy values such as `fail` to the shared `failed` label. |
| `renderOrderSummary` | Renders the compact grouped product summary with a blue product title and per-product detail lines under it. |
| `Cell` | Constrains tall cell content to a scrollable container without forcing the whole row taller than needed. |
| `BookingArchiveTable` | Main archive table renderer. It now shows the admin `Alerts` cell as a full-cell button, always renders the grouped `Products` column for admin and subcontractor views, keeps the `Store` column ahead of `Customer name` in the admin table, renders the admin customer column from `customerName`, and renders archive headers in English. |
