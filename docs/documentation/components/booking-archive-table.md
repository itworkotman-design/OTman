# Booking Archive Table

## Source

- `app/_components/Dahsboard/booking/archive/BookingArchiveTable.tsx`

## Responsibility

Renders the archive table for admin, subcontractor, and order-creator views using the active column configuration.

## Functions

| Function | Description |
| --- | --- |
| `formatCell` | Normalizes empty cell values into `-` for display. |
| `formatDateTime` | Formats ISO timestamps into Norwegian date-time strings for archive cells. |
| `formatMoney` | Formats numeric archive totals as `NOK` strings. |
| `formatStatusCell` | Wraps status text in the status-style badge used throughout the archive. |
| `Cell` | Constrains tall cell content to a scrollable container without forcing the whole row taller than needed. |
| `BookingArchiveTable` | Main archive table renderer. It now shows the internal order `ID` column for subcontractor and order-creator views in the same way admin already did. |
