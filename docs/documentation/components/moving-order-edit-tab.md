# `app/_components/Dahsboard/booking/websiteOrders/MovingOrderEditTab.tsx`

## Purpose
The admin's "Edit order" tab for a homepage move in `WebsiteOrderModal`: both ends with the booking flow's own sections
(`PropertyWhereSection` / `PropertyDetailsSection` — address, type, size, floors with the house preview, floor + lift, parking),
the additional services and the customer's contact details. Every change is priced by
`PUT /api/orders/[orderId]/moving-details` (`dryRun`, debounced) against what was paid (`WebsiteOrderPaymentSummary`) and
saved at that price. Only the changed parts are sent (`movingEditBody.ts`, tested). Date, time window and drivers stay in the
Overview's "Handle order" panel.
