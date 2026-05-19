# Booking Archive Table

## Source

- `app/_components/Dahsboard/booking/archive/BookingArchiveTable.tsx`

## Responsibility

Renders the archive table for admin, subcontractor, and order-creator views using the active column configuration. The admin table now shows the assigned membership `Store` before `Customer name`, the admin customer column reads from the order's `customerName` field instead of store data, order creators see the same alert/mail action column as admins, subcontractor rows show only the subcontractor price, the optional checkbox column supports selected-row Excel exports for subcontractors and order creators as well as admin bulk actions, the status badge now uses the shared status-normalization helper for both its visible label and hover title, archive dates render in explicit `dd/mm/yyyy` or `dd/mm/yyyy HH:mm` format instead of browser-dependent locale output, and the archive exposes synced logoblue horizontal scrollbars above and below the table while still expanding to the real remaining page width when the sidebar collapses.

## Functions

| Function | Description |
| --- | --- |
| `ARCHIVE_SCROLLBAR_CLASS` | Defines the shared logoblue scrollbar styling used by the top and bottom horizontal archive scrollbars. |
| `formatCell` | Normalizes empty cell values into `-` for display. |
| `formatMoney` | Formats numeric archive totals as `NOK` strings. |
| `formatStatusCell` | Wraps status text in the status-style badge used throughout the archive and normalizes legacy values such as `fail` to the shared `failed` label. |
| `renderOrderSummary` | Renders the compact grouped product summary with a blue product title and per-product detail lines under it. |
| `Cell` | Constrains tall cell content to a scrollable container without forcing the whole row taller than needed. |
| `AlertCell` | Renders the shared archive alert/mail button used by admin and order-creator rows and opens the alert/contact modal without triggering row navigation. |
| `BookingArchiveTable` | Main archive table renderer. It now shows the `Alerts` cell as a full-cell button for admin and order-creator views, always renders the grouped `Products` column for admin and subcontractor views, keeps the assigned `Store` column ahead of `Customer name` in the admin table, renders the admin customer column from `customerName`, renders subcontractor prices instead of full customer totals in subcontractor view, renders archive headers in English, formats `deliveryDate`, `createdAt`, and `updatedAt` with the shared slash-date helpers, keeps top and bottom horizontal scrollbars synchronized, lets the archive area fill the available width when the sidebar is collapsed, and renders the optional checkbox column for selected-row actions. |
