# Website Order Modal

## Source

- `app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderModal.tsx`

## Responsibility

A read-only admin view of a homepage white-goods website order, laid out like the customer's own summary page. It's opened by `DashboardOrderModal`.

- **Header:** website order number, display id, status, customer type and created date.
- **Left column:** cards from `buildOrderReviewBlocks` (every pickup stop, the delivery, and the customer's details with their comments), with logo-blue titles and a pin on the location cards. Status notes appear when set.
- **Right column:** products grouped per card, then the order extras. Prices are shown incl. VAT, as stored. Below them, subtotal (ex. VAT), VAT and the highlighted "Total incl. VAT" (`getVatBreakdown` on the client total).
- **Footer:** "Open in standard editor" swaps to the regular `OrderModal`, so no existing admin capability is lost. "Delete order" appears only with `canDelete`, using the same `DELETE /api/orders/[orderId]` as `OrderModal`.
