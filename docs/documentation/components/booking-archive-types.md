# Booking Archive Types

## Source

- `app/_components/Dahsboard/booking/archive/types.ts`

## Responsibility

Defines the archive view modes, filter/access shapes, and the order-row payload used by the archive table and related UI.

## Types

| Type | Description |
| --- | --- |
| `BookingArchiveViewMode` | Declares the supported archive role views. |
| `BookingArchiveFilters` | Stores the archive filter and pagination state, including the selected creator filter id. |
| `BookingArchiveAccess` | Describes archive permissions and locked filters for the active user, including whether the creator filter is available. |
| `BookingArchiveOption` | Represents a selectable archive filter option and can also carry optional primary and warehouse email addresses for creator-driven actions. |
| `OrderRow` | Defines the row data used by the archive, including the grouped `orderSummaryGroups` and `orderSummaryText` fields for the compact product column. |
