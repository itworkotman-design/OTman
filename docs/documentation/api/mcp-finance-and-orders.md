# MCP Finance Summary and Orders List

## Source

- `app/api/integrations/mcp/finance/summary/route.ts`
- `app/api/integrations/mcp/orders/list/route.ts`

## Responsibility

Read-only MCP endpoints (bearer `OTMAN_API_KEY`, company from `X-Otman-Company-Id`).

- **Finance summary:** revenue (incl. VAT) per store over a date range.
- **Orders list:** recent orders with discount, extra, VAT, total and lines.

Customer totals and VAT come from `getPricingSnapshotCustomerVatTotals`, so homepage (`WHITE_GOODS`) orders, which are already VAT-inclusive, aren't counted with 25% VAT on top.
