# `lib/sms/reviewRequestSweep.ts`

| Export | Description |
| --- | --- |
| `runReviewRequestSmsSweep` | Called by `POST /api/cron/review-request-sms` (schedule every ~15 min). It texts customers only between `REVIEW_SMS_FIRST_HOUR` (09) and `REVIEW_SMS_END_HOUR` (22) Oslo time. It does nothing when not configured or when no company has an enabled `REVIEW_REQUEST` template. Otherwise it picks orders that are still `completed`/`ferdig`, have `gsmCompletedAt` **today in Oslo time** (since `getOsloStartOfDay`), a `deliveryDate` in the last 7 days, no `reviewSmsSentAt`, and are not GDPR-anonymized. It then sends via `sendAutomaticSmsToOrders`. |

## Only GSM completions trigger it

`Order.gsmCompletedAt` is set **only** by the GSM webhook (`app/api/integrations/gsm/webhook/route.ts`) when it auto-completes an order. Completing an order in the order editor or by bulk update never sets it, so manual status changes never send a review SMS. That includes an admin completing an order after a GSM auto-complete was blocked by driver notes.

## Guards

- **Same-day only:** the SMS is only sent on the Oslo calendar day GSM completed the order, so old orders never get one. This includes when the template is first switched on. An order completed after 22:00, or one that no run reached that day, gets no review request.
- An order completed before 09:00 gets its SMS at the first run after 09:00 the same day.
- The 7-day delivery-date window stops review requests when a late GSM webhook completes a long-ago delivery.
- The order must still be `completed` when the run sees it. One moved back to another status, or on to invoiced/paid, is not texted.
