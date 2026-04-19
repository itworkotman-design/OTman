# Booking Archive Columns

## Source

- `lib/booking/archiveColumns.ts`

## Responsibility

Defines the column sets, export metadata, and visibility helpers used by the booking archive across each dashboard role view.

## Functions

| Function | Description |
| --- | --- |
| `formatCell` | Normalizes empty export values into `-`. |
| `formatDateTime` | Formats archive timestamps for export. |
| `formatMoney` | Formats archive numeric totals as `NOK` strings for export. |
| `getBookingArchiveColumns` | Returns the configured column list for a given archive view mode. |
| `getDefaultVisibleBookingArchiveColumns` | Returns the default visible-column order for a given view mode. |
| `sanitizeVisibleBookingArchiveColumns` | Filters persisted column ids down to the valid ids for the current view mode. |
| `getBookingArchiveExportColumns` | Returns the currently visible columns that are exportable. |
| `getBookingArchiveVisibilityStorageKey` | Builds the local-storage key used to persist archive column visibility. |

## Notes

- `SUBCONTRACTOR` and `ORDER_CREATOR` now include the `displayId` column so non-admin users can see the same order id admins already had.
