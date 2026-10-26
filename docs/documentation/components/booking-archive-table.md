# Booking Archive Table

## Source

- `app/_components/Dahsboard/booking/archive/BookingArchiveTable.tsx`

## Responsibility

Renders the archive table for admin, subcontractor, and order-creator views using the active column configuration. The admin table shows the assigned membership `Store` before `Customer name`, reads the customer column from the order's `customerName`, and includes admin-only normalized `Drivers` and DNB discount columns. Driver cells render configured names canonically, join supported multi-driver values with commas, preserve unmatched text, and render blank, zero, and dash-only values as the localized `No driver` label. Order creators see the same alert/mail action column as admins, customer price cells show the effective total from `priceExVat - rabatt + leggTil`, subcontractor price cells show the effective total from `priceSubcontractor - subcontractorMinus + subcontractorPlus`, cancelled price cells derive the auto-discount when the matching adjustment is blank, the optional checkbox column supports selected-row Excel exports for subcontractors and order creators as well as admin bulk actions, the status badge uses the shared status-normalization helper for both its visible label and hover title, archive dates render in explicit `dd/mm/yyyy` or `dd/mm/yyyy HH:mm` format instead of browser-dependent locale output, and the archive exposes synced logoblue horizontal scrollbars above and below the table while still expanding to the real remaining page width when the sidebar collapses.

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
| `BookingArchiveTable` | Main archive table renderer. It shows the `Alerts` cell as a full-cell button for admin and order-creator views, always renders the grouped `Products` column for admin and subcontractor views, keeps the assigned `Store` column ahead of `Customer name` in the admin table, renders the admin customer column from `customerName`, renders normalized driver values only for admin rows, renders the admin-only DNB discount column, renders customer and subcontractor price cells from the effective archive totals, formats archive dates with the shared slash-date helpers, keeps top and bottom horizontal scrollbars synchronized, lets the archive area fill the available width when the sidebar is collapsed, and renders the optional checkbox column for selected-row actions. |

## GSM / SMS markers

An 8px tab sitting directly on top of the alert button. It is anchored to the button through a `relative` wrapper with `bottom-full`, so it stays attached even when a taller row centres the button. It fits the cell's top `py-2` padding, spans the button's width, and its top corners use the button's `rounded-md`. While it is shown, the button switches to `rounded-b-md`, so tab and button connect into one shape. The cell's top padding grows from `pt-2` to `pt-4` on those rows, so the usual 8px of space stays above the tab. It is split 50/50:

- **Left half, green:** shown when `order.gsmSentAt` is set. Tooltip "Sent to GSM dd.mm, HH:MM".
- **Right half:** shown when the order has an SMS, coloured by the latest SMS (`order.smsStatus`): blue = delivered, grey = sent and waiting for delivery, red = failed. The tooltip shows the status, `order.smsAt`, and `(N SMS)` when more than one was sent.

Each half (`MarkerHalf`) shows an instant CSS tooltip on hover, a dark label above the tab. It replaces the native `title`, which on an 8px target practically never appears. Tooltip texts are translated via `bookingText`. The fields are only set for admins.
