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
Six sections — Privat/Bedrift (`CustomerTypeStep`, asked first and only
once, so the size-tier tile prices shown later are already
in the right VAT mode), home type (`TileSelectStep` with
`MOVING_HOME_TYPES` — Leilighet/Rekkehus/Enebolig/Kontor, auto-advances on pick,
sent as `homeType`, required to submit), move details (addresses + size-bracket picker with
live prices, with a `HouseIllustration` preview + floors stepper (1–4,
starts at 1) to its right, sent as `floors`), additional services (optional
toggle tiles for Nedpakking/Flyttevask with price + blurb, sent
as `serviceCodes`; always present so step positions never shift), timing,
contact details — plus
a final review/submit step
showing the size + selected services total (`movingCustomerTotals`). Copy makes clear the price is based
on the self-reported size and gets confirmed on staff review, not
literally instant.
