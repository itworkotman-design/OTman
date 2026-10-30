# Website Order Modal

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderModal.tsx`

## Responsibility

The modal frame around `WebsiteOrderPanel` (see `website-order-panel.md`): the "Editing website order - {displayId}" title and the close button, which asks first when the panel reports unsaved changes. Opened by `DashboardOrderModal`. Admin row clicks open the Alert Center instead, which shows the same panel in its Edit order tab. Re-exports `WebsiteOrderView`.
