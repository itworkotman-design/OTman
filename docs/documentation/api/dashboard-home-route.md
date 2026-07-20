# Dashboard Home Route

## Source

- `app/api/dashboard/home/route.ts`

## Responsibility

Returns dashboard summary data for the active company and lets owners or admins enable or disable outbound order emails at company level.

## Functions

| Function | Description |
| --- | --- |
| `getMonthRange` | Builds the current month date range used by the dashboard aggregates. |
| `buildMonthlyComparison` | Builds the month-by-month order count comparison between the current and previous year. |
| `buildMonthlyRevenue` | Builds the month-by-month subcontractor cost and profit comparison between the current and previous year. |
| `buildLeaderboard` | Groups the current year's orders by store (`customerMembershipId`) or subcontractor (`subcontractorMembershipId`) into ranked `LeaderboardEntry` lists with order count and profit. |
| `GET` | Validates the active admin or owner membership, returns dashboard counts, status breakdown, monthly revenue/comparison series, the store and subcontractor leaderboards for the current year, and the current `orderEmailsEnabled` flag. |
| `PATCH` | Validates the active admin or owner membership and updates the company's `orderEmailsEnabled` flag. |
