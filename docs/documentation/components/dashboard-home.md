# Dashboard Home

## Source

- `app/_components/Dahsboard/home/DashboardHome.tsx`

## Responsibility

Loads dashboard metrics, shows online members and booking-email stats, and exposes manual quick tasks from the dashboard home screen, including the month-end summary action and the company-level outbound order-email toggle.

## Functions

| Function | Description |
| --- | --- |
| `formatNOK` | Formats dashboard totals as Norwegian kroner strings. |
| `getOnlineMemberLabel` | Chooses the label used for online-member cards. |
| `StatusBreakdownChart` | Renders the status-distribution card for current order statuses. |
| `buildSeriesPoints` | Converts daily numeric values into SVG chart coordinates. |
| `DailySeriesChart` | Renders one interactive daily line chart with hover details. |
| `DailyActivityChart` | Renders the dual daily orders and revenue charts for the current month. |
| `DashboardHome` | Main dashboard home component. It fetches dashboard metrics and online members, renders the `Quick Tasks` card, and manages both the finish-month action and the `orderEmailsEnabled` toggle for outbound order emails. |
| `handleFinishMonth` | Calls the month-end summary route and shows inline success or error feedback. |
| `handleToggleOrderEmails` | Calls the dashboard home `PATCH` route to enable or disable outbound order emails for the active company and reflects the result inline. |
