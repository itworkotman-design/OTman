# `app/_components/Dahsboard/booking/orders/WebsitePartnerOrderView.tsx`

## Purpose
What `ReadOnlyOrderModal` shows for a homepage website order (from `GET /api/orders/[orderId]/partner-view`): the job as
booked in the same cards as the admin modal and the customer's summary (`OrderReviewBlocks`), the internal description and
driver info, and the partner's price line by line totalling the stored partner price (a warning when the lines don't add up).
Customer totals only for non-partners.

## Exports
- `useWebsitePartnerView(orderId)` — `loading` / `website` (with `view`) / `other` (not a website order).
- `websitePartnerReviewBlocks(view, locale)`, `downloadWebsitePartnerPdf(view, locale)` — the printable version.
