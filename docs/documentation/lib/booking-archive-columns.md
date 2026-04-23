# Booking Archive Columns

## Source

- `lib/booking/archiveColumns.ts`

## Responsibility

Defines the column sets, export metadata, and visibility helpers used by the booking archive across each dashboard role view. The admin view now labels the creator column as `Store`, keeps that store column ahead of `Customer name`, uses the order `customerName` field for the admin customer column, and visibility sanitizing migrates older saved admin layouts from `customerName` to `createdBy`.

## Functions

| Function | Description |
| --- | --- |
| `formatCell` | Normalizes empty export values into `-`. |
| `formatDateTime` | Formats archive timestamps for export. |
| `formatMoney` | Formats archive numeric totals as `NOK` strings for export. |
| `getBookingArchiveColumns` | Returns the configured column list for a given archive view mode. |
| `getDefaultVisibleBookingArchiveColumns` | Returns the default visible-column order for a given view mode. |
| `sanitizeVisibleBookingArchiveColumns` | Filters persisted column ids down to the valid ids for the current view mode and migrates older admin `customerName` visibility to `createdBy`. |
| `getBookingArchiveExportColumns` | Returns the currently visible columns that are exportable. |
| `getBookingArchiveVisibilityStorageKey` | Builds the local-storage key used to persist archive column visibility. |

## Notes

- `SUBCONTRACTOR` and `ORDER_CREATOR` now include the `displayId` column so non-admin users can see the same order id admins already had.
- The admin `mail` column id is still used internally for saved column visibility and exports, but its user-facing label is now `Alerts` because the cell combines email attention and non-email order notifications.
- Admin and subcontractor views now use a single `orderSummary` column instead of separate `productsSummary`, `deliveryTypeSummary`, and `servicesSummary` columns. The export value comes from the shared compact summary text.
- Saved column visibility now migrates the removed legacy summary ids to `orderSummary`, keeps `orderSummary` always visible for admin and subcontractor archive views, and automatically restores `priceExVat` when `priceSubcontractor` is still visible.
- Column labels and export headers are now English.
