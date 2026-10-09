# Status Presentation

## Source

- `lib/orders/statusPresentation.ts`

## Responsibility

Provides the shared order-status normalization and presentation helpers used by archive tables, API responses, and editor hydration. The helper keeps legacy imported values such as `fail` aligned with the canonical app status `failed`.

## Functions

| Function | Description |
| --- | --- |
| `WEBSITE_ORDER_STATUS_OPTIONS` | The only statuses homepage (public, prepaid) orders use: processing, rejected, confirmed, active, failed, cancelled, completed. No `approved` (orders are prepaid) and no B2B `invoiced`/`paid`. |
| `isAllowedWebsiteOrderStatus` | True when a status (after normalizing aliases) is in `WEBSITE_ORDER_STATUS_OPTIONS`. The bulk and single-order PATCH routes use it to refuse other statuses on website orders. |
| `normalizeOrderStatus` | Maps legacy or localized order-status values onto the app's canonical lowercase status keys. |
| `getOrderStatusStyle` | Returns the badge colors used for a normalized order status. |
| `getOrderStatusLabel` | Returns the normalized status label used in archive cells and other status displays. |
