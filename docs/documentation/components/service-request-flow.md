# `app/_components/site/BookingModal/services/ServiceRequestFlow.tsx`

## Purpose
The homepage "Services" card's booking modal (routed by `serviceModalKind` →
`"services"`), built on `SteppedModal` like `WhiteGoodsBookingFlow` and
`MovingRequestFlow`. Sections: customer type (`CustomerTypeStep`) → which
service (icon tiles from `SERVICE_REQUEST_OPTIONS`, a text field for the
custom service) → address (`AddressAutocompleteInput`, must be picked from
the suggestions) → timing (`DateTimeWindowFields`) → contact details plus a
required job description → review page (`buildServiceReviewBlocks`) with the
submit button. Not priced: posts to `/api/site/service-request`, which creates
an unpriced website order for staff to quote.

## Functions
### `ServiceRequestFlow({ locale, onClose })`
Holds the flow's state and renders the `SteppedModal`. The custom service's
text only completes the step once the field loses focus (or Enter), so the
address step doesn't open and scroll on the first typed letter.
