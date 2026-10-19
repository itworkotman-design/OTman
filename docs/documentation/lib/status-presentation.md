# Status Presentation

## Source

- `lib/orders/statusPresentation.ts`

## Responsibility

Provides the shared order-status normalization and presentation helpers used by archive tables, API responses, and editor hydration. The helper keeps legacy imported values such as `fail` aligned with the canonical app status `failed`.

`ORDER_STATUS_OPTIONS` is the canonical status list (`pending` first, then `processing` … `paid`). Several places keep their own hand-written status list and must be updated alongside it: the filter dropdowns in `TopFiltersField.tsx` and `BookingFilters.tsx`, `normalizeInitialStatus` in `BookingEditor.tsx`, `NB_STATUS_LABELS` in `lib/booking/bookingUiText.ts`, and `STATUS_RAW_VARIANTS` in `app/api/integrations/mcp/orders/list/route.ts`.

## Functions

| Function | Description |
| --- | --- |
| `normalizeOrderStatus` | Maps legacy or localized order-status values onto the app's canonical lowercase status keys. |
| `getOrderStatusStyle` | Returns the badge colors used for a normalized order status. |
| `getOrderStatusLabel` | Returns the normalized status label used in archive cells and other status displays. |
