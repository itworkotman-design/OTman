# app/_components/utils/DatePicker.tsx

Reusable single-date picker; drop-in replacement for `<input type="date">` with the same look as the booking archive's custom date-range calendar (`BookingFilters`).

- Props: `id` (put on the trigger button, so scroll/focus-to-field works), `value`/`onChange` (`"YYYY-MM-DD"` or `""`), optional `min` (earlier days are disabled), `disabledWeekdays` (`Date.getDay()` numbers, 0 = Sunday), `locale` (`en`/`nb`), `placeholder`, `className`.
- One-month popover with Previous/Next, Monday-first weeks, today ringed, selected day filled, Saturdays orange and Sundays red; closes on selection, outside click or Escape.
- Used for the order delivery date in `OrderFieldsForm`, which disables Sundays for order creators. Month-grid helpers come from `lib/dates/calendarMonth.ts`.
