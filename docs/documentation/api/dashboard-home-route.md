# Dashboard Home Route

## Source

- `app/api/dashboard/home/route.ts`

## Responsibility

Returns dashboard summary data for the active company and lets owners or admins enable or disable outbound order emails at company level.

## Functions

| Function | Description |
| --- | --- |
| `getMonthRange` | Builds the current month date range used by the dashboard aggregates. |
| `formatDateKey` | Converts a `Date` into the `YYYY-MM-DD` key used by the daily activity series. |
| `buildDailyActivity` | Builds the day-by-day order and revenue list returned to the dashboard charts. |
| `GET` | Validates the active admin or owner membership, returns dashboard counts, status breakdown, daily activity, and the current `orderEmailsEnabled` flag. |
| `PATCH` | Validates the active admin or owner membership and updates the company's `orderEmailsEnabled` flag. |
