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
5. Timing, 6. contact details — then a final review/submit step listing both ends (`propertySummary`), services and the total (`movingCustomerTotals`).

Both ends are `MovingPropertyDraft`s (`lib/orders/movingProperty.ts`), submitted as `origin` / `destination`; "can continue/submit" uses the same `parseMovingProperty` the API validates with. Copy makes clear the price is based on the self-reported size and gets confirmed on staff review.

Sections advance like the delivery modal: no Continue buttons — each opens the next one as soon as its
required fields are answered (`AutoAdvance`; the services step has none, so it opens the next right away).
The contact step is the one exception, with a "Gå til oppsummering" button, since moving on swaps the
modal to the summary.

The "When?" step reuses the delivery modal's date/time layout: a bordered card with
`DateTimeWindowFields` (same date picker rules and time windows, incl. a specific time); it opens
the next section once a date is picked and `isTimeWindowComplete(timeWindow)`.

One live calculator follows the flow from "Hvor flytter du fra?" through "Når?", until "Dine opplysninger":
SteppedModal's `aside` (sticky 400px right column, stacked under on small screens), showing
`WhiteGoodsOrderSummary` fed by `movingSummary`, with the same totals as the charge (`movingCustomerTotals`).
