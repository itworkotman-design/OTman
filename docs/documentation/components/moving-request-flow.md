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
`CustomerTypeStep`/`getVatDisplayTotal` from the white-goods flow (see
`docs/homepage-ordering-roadmap.md` §2) for consistent totals display.
Submits to `POST /api/site/moving-request`.

## Functions
### `MovingRequestFlow({ locale, onClose })`
Four sections — Privat/Bedrift (`CustomerTypeStep`, asked first and only
once, so the size-tier tile prices shown on the very next step are already
in the right VAT mode), move details (addresses + size-bracket picker with
live prices), timing, contact details — plus a final review/submit step
showing the selected bracket's total. Copy makes clear the price is based
on the self-reported size and gets confirmed on staff review, not
literally instant.
