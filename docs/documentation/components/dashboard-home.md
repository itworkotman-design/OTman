# Dashboard Home

## Source

- `app/_components/Dahsboard/home/DashboardHome.tsx`

## Responsibility

Loads dashboard metrics, shows online members and booking-email stats, and now exposes manual quick tasks from the dashboard home screen.

## Functions

| Function | Description |
| --- | --- |
| `formatNOK` | Formats dashboard totals as Norwegian kroner strings. |
| `getOnlineMemberLabel` | Chooses the label used for online-member cards. |
| `StatusBreakdownChart` | Renders the status-distribution card for current order statuses. |
| `buildSeriesPoints` | Converts daily numeric values into SVG chart coordinates. |
| `DailySeriesChart` | Renders one interactive daily line chart with hover details. |
| `DailyActivityChart` | Renders the dual daily orders and revenue charts for the current month. |
| `DashboardHome` | Main dashboard home component. It fetches dashboard metrics and online members, and now includes a `Quick Tasks` card with a `Finish month` button that calls the month-end summary route and shows success or failure feedback inline. |
