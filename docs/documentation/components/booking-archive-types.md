# Booking Archive Types

## Source

- `app/_components/Dahsboard/booking/archive/types.ts`

## Responsibility

Defines the archive view modes, filter/access shapes, and the order-row payload used by the archive table and related UI. The row payload also includes the read-only PDF fields and saved calculator item prices used by subcontractor and order-creator PDF previews/downloads.

## Types

| Type | Description |
| --- | --- |
| `BookingArchiveViewMode` | Declares the supported archive role views. |
| `BookingArchiveFilters` | Stores the archive filter and pagination state, including the selected creator filter id. |
| `BookingArchiveAccess` | Describes archive permissions and locked filters for the active user, including whether the creator filter is available. |
| `BookingArchiveOption` | Represents a selectable archive filter option and can also carry optional primary and warehouse email addresses for creator-driven actions. |
| `OrderRow` | Defines the row data used by the archive, including grouped summaries, customer contact/floor/lift/distance fields, manual price adjustments, and calculator items for the read-only PDF modal. |
| `OrderCalculatorItem` | Defines one saved order item line with role-specific customer and subcontractor price cents for PDF calculator rendering. |
