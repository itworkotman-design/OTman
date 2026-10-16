# `app/_components/site/BookingModal/services/ServiceRequestFlow.tsx`

## Purpose
The homepage "Services" card's booking modal (routed by `serviceModalKind` →
`"services"`), built on `SteppedModal` like `WhiteGoodsBookingFlow` and
`MovingRequestFlow`. Sections: customer type (`CustomerTypeStep`) → which
services (icon tiles from `SERVICE_REQUEST_OPTIONS`, any number — each picked
service gets its own box under the tiles: a name for the custom one and the
required "what needs doing", saved with that service) → address (`AddressAutocompleteInput`, must be
picked from the suggestions) → timing (`DateTimeWindowFields`) → contact
details plus an optional comment (`notes` → `Order.customerComments`, its own
thing) → review page (`buildServiceReviewBlocks`) with the submit button. Not
priced: posts to `/api/site/service-request`, which creates an unpriced
website order for staff to quote.

## Functions
### `ServiceRequestFlow({ locale, onClose, customer? })`
Holds the flow's state and renders the `SteppedModal`. The service step is
complete as soon as every picked service is described (and a custom one named),
opening the address step right away; it's held while any service is picked, so
adding another doesn't fold the steps already opened.

With `customer` (`ServiceCustomerEdit`: "My order") it loads the customer's
own request from `/api/customer/orders/[orderNumber]`, shows every section but
the customer type, and saves through `CustomerOrderEditFooter`. Within 24h of
the job only the service step (its tiles locked, the descriptions editable) and
"Your details" are shown.
