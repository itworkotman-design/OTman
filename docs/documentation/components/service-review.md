# `app/_components/site/BookingModal/services/serviceReview.ts`

## Purpose
The text half of the services flow's review page, in the same `ReviewBlock`
shape as the delivery/moving reviews so it renders through `OrderReviewBlocks`.

## Functions
### `buildServiceReviewBlocks(locale, input)`
Four blocks — Service(s) (customer type, then one row per service: its label
with what needs doing), Where (address), Timing (formatted date, window), Your
details (with the customer's comment) — with blank answers left out. Tested.
