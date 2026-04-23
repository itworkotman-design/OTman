# `lib/orders/archiveFilters.ts`

## Purpose
Stores the shared default archive filter state and the quick date-range helpers used by the booking archive.

## Functions
### `getTodayRange()`
Returns today's delivery-date range in ISO format.

### `getTomorrowRange()`
Returns tomorrow's delivery-date range in ISO format.

### `getThisWeekRange()`
Returns the current Monday-through-Sunday delivery-date range in ISO format.

### `getThisMonthRange()`
Returns the first-through-last-day range for the current month in ISO format.
