# `app/_components/Dahsboard/booking/archive/BookingFilters.tsx`

## Purpose
Renders the archive filter panel used on the booking archive pages.

## Functions
### `parseIsoDate(value)`
Parses a `YYYY-MM-DD` string into a local `Date` and rejects invalid dates.

### `toIsoDate(date)`
Formats a `Date` into a `YYYY-MM-DD` string for filter state and calendar keys.

### `startOfMonth(date)`
Returns the first day of the month for the provided date.

### `addMonths(date, count)`
Moves the visible calendar month backward or forward by a number of months.

### `buildCalendarDays(month)`
Builds the 6-week day grid shown in the custom date-range picker.

### `formatDisplayDate(value)`
Formats an ISO date into the user-facing date text shown in the filter panel.

### `formatRangeLabel(fromDate, toDate)`
Builds the button label for the selected date range.

### `getMonthLabel(month)`
Formats the visible calendar month header.

### `isIsoWithinRange(value, fromDate, toDate)`
Checks whether a calendar day falls inside the active date range.

### `isRangeBoundary(value, fromDate, toDate)`
Checks whether a calendar day is the start or end of the active date range.

### `BookingFilters(props)`
Owns the archive filter state, renders the status/store/subcontractor/date/search controls, keeps status option values aligned with the canonical lowercase order-status keys, auto-applies filter changes with a short debounce, syncs the latest parent `onApply` callback into a ref through an effect so parent rerenders do not trigger repeated fetch loops, skips duplicate apply calls on first render and reset, and resets the selected filter values without needing an explicit Apply button.

### `Field(props)`
Shared small wrapper for a filter label and its input content.
