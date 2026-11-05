# lib/dates/calendarMonth.ts

Month-grid helpers shared by the custom calendar pickers (`BookingFilters` date range, `DatePicker`, `PeriodPicker`).

## Functions

- `startOfMonth(date)` / `addMonths(date, count)` — first day of the (shifted) month.
- `buildCalendarDays(month)` — 42 `CalendarDay`s (`iso`, `dayOfMonth`, `inCurrentMonth`), Monday-first, padded with neighbouring months.
- `buildYearMonths(year, locale)` — the month view's twelve `{ key: "YYYY-MM", label }` entries ("Jan" / "Mai").
- `getMonthLabel(month, locale)` — e.g. "oktober 2026" / "October 2026".
- `isCalendarDayDisabled(iso, { min, disabledWeekdays })` — `true` for days before `min` or on a listed weekday (`Date.getDay()` numbering, 0 = Sunday).
- `getWeekendDay(iso)` — `"saturday"`, `"sunday"` or `null`.
- `WEEKDAY_LABELS` — Mon–Sun labels per locale.
