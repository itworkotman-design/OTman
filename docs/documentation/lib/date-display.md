# Date Display

## Source

- `lib/dateDisplay.ts`

## Responsibility

Provides explicit `dd/mm/yyyy` and `dd/mm/yyyy HH:mm` formatters for dashboard-facing order dates so archive and modal views do not depend on browser locale defaults.

## Functions

| Function | Description |
| --- | --- |
| `formatDisplayDate` | Formats a `Date` or date string into `dd/mm/yyyy`, preserving raw invalid strings instead of silently changing them. |
| `formatDisplayDateTime` | Formats a `Date` or timestamp string into `dd/mm/yyyy HH:mm` for archive timestamps. |
