# `app/_components/site/BookingModal/services/ServiceRequestFlow.tsx`

## Purpose
The homepage "Services" card's booking modal (routed by `serviceModalKind` →
`"services"`), built on `SteppedModal` like `WhiteGoodsBookingFlow` and
`MovingRequestFlow`. Sections: customer type (`CustomerTypeStep`) → which
service (icon tiles from `SERVICE_REQUEST_OPTIONS`, a text field for the
custom service, and the required "what needs doing" description right under
it — saved with the service) → address (`AddressAutocompleteInput`, must be
picked from the suggestions) → timing (`DateTimeWindowFields`) → contact
details plus an optional comment (`notes` → `Order.customerComments`, its own
thing) → review page (`buildServiceReviewBlocks`) with the submit button. Not
priced: posts to `/api/site/service-request`, which creates an unpriced
website order for staff to quote.

## Functions
### `ServiceRequestFlow({ locale, onClose, customer? })`
Holds the flow's state and renders the `SteppedModal`. The custom service's
text completes the service step once the field loses focus (or Enter); the job
description completes it as soon as it has any text, opening the address step
right away.

With `customer` (`ServiceCustomerEdit`: "My order") it loads the customer's
own request from `/api/customer/orders/[orderNumber]`, shows every section but
the customer type, and saves through `CustomerOrderEditFooter`. Within 24h of
the job only the service step (its tiles locked, the description editable) and
"Your details" are shown.
