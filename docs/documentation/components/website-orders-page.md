# `app/(User)/dashboard/website-orders/page.tsx`

## Purpose
Dashboard page listing homepage (public customer) orders (`/api/orders?isWebsiteOrder=true`). Has the same tooling as the main booking orders page (`booking-page.md`), minus the B2B-only parts.

## Behaviour
- **Filters** (`BookingFilters`): status (`WEBSITE_ORDER_STATUS_OPTIONS`: processing, rejected, confirmed, active, failed, cancelled, completed), partner, dates, search, orders per page. There are no store, pricelist or pickup-address filters.
- **Bulk update** (`BulkUpdateBar` with `WEBSITE_ORDER_STATUS_OPTIONS`): status/partner change for the selected orders; rejecting prompts for the required reason. There is no separate approve/reject bar and no customer payment/lifecycle email buttons; status is set the same way as on the main page.
- **Selection actions** (`SelectionActionBar`): Send to GSM, Export Excel, Hide columns. The store "prepare orders" email and Copy selected are left out: a copy would lose the website-order flag, the public order number and the customer login.
- **Columns**: `getWebsiteOrdersColumns()` (admin columns without store/cashier/DNB). The visible set is saved to localStorage under its own key (`getWebsiteOrdersVisibilityStorageKey()`).
- Shows the selected price total, a Refresh button and a 60s heartbeat (`websiteOrdersOnly: true`), so only website-order changes turn Refresh red.
- The order modal opens with `canDelete={false}`, so website orders are cancelled or rejected rather than deleted.
