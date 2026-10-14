# `app/_components/site/BookingModal/moving/MovingRequestFlow.tsx`

## Purpose
The homepage "Flytting" (Moving) tile's real flow, replacing the placeholder
`SteppedModal` content that used to render there (see
`app/_components/site/TransportService/ServiceWindow.tsx`'s
`MOVING_SERVICE_ID` branch). Built on the same `SteppedModal` shell as
`WhiteGoodsBookingFlow`, but far simpler: no product cards, no pricing engine
— price comes from a flat size-bracket lookup
(`GET /api/site/moving-request/catalog`, `lib/content/getMovingCatalog.ts`),
not the shared `calculateBookingPricing` engine. Reuses the Privat/Bedrift
`CustomerTypeStep` from the white-goods flow (see
`docs/homepage-ordering-roadmap.md` §2). The moving price list's prices are
ex. VAT like every website price: a private customer sees each size's price
+25%, rounded to whole kroner (`websiteCustomerPrice`), and the total via
`websiteCustomerTotalDisplay` (`lib/booking/pricing/websiteVat.ts`); a
business customer sees ex. VAT. The payment link charges that same incl.-VAT
amount (`lib/orders/movingOrderPricing.ts`).
Submits to `POST /api/site/moving-request`.

## Functions
### `MovingRequestFlow({ locale, onClose })`
Sections:
1. Privat/Bedrift (`CustomerTypeStep`) — asked first so the size prices on the next step are already in the right VAT mode.
2. "Hvor flytter du fra?" — `PropertySection` for the origin (address, type, size with live prices, floors + `HouseIllustration`, lift for apartment/office, parking distance). Its size is what the move is priced on.
3. "Hvor flytter du til?" — the same `PropertySection` for the destination, size tiles without prices (information for staff).
4. Additional services — optional toggle tiles (Nedpakking/Flyttevask) with price + blurb, sent as `serviceCodes`; always present so step positions never shift.
5. Timing, 6. contact details — then the review/submit step, laid out like the delivery modal's: the answers as cards on the left (`buildMovingReviewBlocks` → `OrderReviewBlocks`), the order-summary card (`movingSummary`) with the delivery review's VAT breakdown (`ReviewTotalFooter`), the price note and the send button on the right.

Both ends are `MovingPropertyDraft`s (`lib/orders/movingProperty.ts`), submitted as `origin` / `destination`; "can continue/submit" uses the same `parseMovingProperty` the API validates with. Copy makes clear the price is based on the self-reported size and gets confirmed on staff review.

Sections advance like the delivery modal: no Continue buttons — each opens the next one as soon as its
required fields are answered (`AutoAdvance`; the services step has none, so it opens the next right away).
The contact step is the one exception, with a "Gå til oppsummering" button, since moving on swaps the
modal to the summary.

The "When?" step reuses the delivery modal's date/time layout: a bordered card with
`DateTimeWindowFields` (same date picker rules and time windows, incl. a specific time); it opens
the next section once a date is picked and `isTimeWindowComplete(timeWindow)`.

One live calculator follows the flow from "Om stedet du flytter fra" through "Når?", until "Dine opplysninger"
("Hvor flytter du fra?" stays full width):
SteppedModal's `aside` (sticky 400px right column, stacked under on small screens), showing
`WhiteGoodsOrderSummary` fed by `movingSummary`, with the same totals as the charge (`movingCustomerTotals`).

Each end of the move is two sections (`PropertyWhereSection` then `PropertyDetailsSection`): "Hvor flytter du fra?"
(address + type), "Om stedet du flytter fra" (size, floors, lift, floor, parking — priced), then the same for
"Hvor flytter du til?" / "Om stedet du flytter til". Section ids: `moving-from`, `moving-from-details`,
`moving-to`, `moving-to-details`; the calculator `aside` runs from `moving-from-details` until `your-details`.

Driving distance: once both addresses are picked from the suggestions, the flow looks up pickup → delivery via
`POST /api/site/route-distance` (debounced 700 ms, like the delivery modal) and adds the km charge
(`movingDistanceLines` with the catalog's `distanceRates`) to the live calculator, the total and the review step.
The server re-does the lookup itself on submit.

"My order" (`customer` prop, `MovingCustomerEdit`): the customer's own move loaded from `/api/customer/orders/[orderNumber]`
into the flow, every section open (`showAll`), saved from `CustomerOrderEditFooter` (server-priced, confirmed total). Within
24h of the job only the additional services (booked ones can't be removed) and the contact details. The booking-only buttons
("Gå til oppsummering", "Send bestilling") are hidden; the edit bar takes over.

The booking modal passes `scrollToNewSections` to `SteppedModal`, so each newly revealed step scrolls smoothly into view (not when re-revealing steps after going back to edit an earlier one).

In "My order" (`customer`), what staff set on the move's price (`pricingContext`: discount, extra, lines set to 0) is applied to the live calculator and the summary page: each line is keyed like its stored line (`movingLineKeyFor`), a line set to 0 shows 0 kr, the discount/extra get their own rows (`buildOrderAdjustmentLines`), and the totals come from `movingCustomerLiveTotals` — the price the server prices the change at.
