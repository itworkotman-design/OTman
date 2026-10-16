# `app/_components/site/BookingModal/services/serviceReview.ts`

## Purpose
The text half of the services flow's review page, in the same `ReviewBlock`
shape as the delivery/moving reviews so it renders through `OrderReviewBlocks`.

## Functions
### `buildServiceReviewBlocks(locale, input)`
Four blocks — Service (customer type, service label, job description), Where
(address), Timing (formatted date, window), Your details — with blank answers
left out.
