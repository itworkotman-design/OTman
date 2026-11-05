# app/_components/utils/PeriodPicker.tsx

Picks a whole month or a single day, in the same style as `DatePicker`.

- Value: `{ kind: "month", month: "YYYY-MM" }` or `{ kind: "day", date: "YYYY-MM-DD" }`.
- Opens on the view of the current value. A Month/Day toggle at the top switches views:
  - **Month view:** a year's twelve months (`buildYearMonths`), with Previous/Next moving a year.
  - **Day view:** the day calendar (`CalendarDayGrid`), with Previous/Next moving a month.
- The popover has a fixed width (`w-80`), so it doesn't depend on the trigger's width. It closes on selection, outside click or Escape.
- `formatPeriod(value, locale)`: "November 2026" or "05.11.2026".

Used by `WebSalesReportSection`.
