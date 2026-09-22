# `app/_components/site/BookingModal/specialGoods/SpecialGoodsQuoteFlow.tsx`

## Purpose
The homepage's 5th "Book a service" tile ("Spesialvarer"/Special goods),
wired in `ServiceWindow.tsx` via `SPECIAL_GOODS_SERVICE_ID`. Built on the
same `SteppedModal` shell as Moving, with no pricing engine — a quote
request, not a priced booking. 4 sections: item details (description +
optional dimension picker, mined from the dead `ServiceModal.tsx` per the
step-1 plan — see `docs/homepage-ordering-roadmap.md` §3a), photos
(optional, uploads immediately per-file to
`app/api/site/special-goods-quote/upload/route.ts`), pickup/delivery, and
contact details (with a honeypot field). Submits to
`POST /api/site/special-goods-quote`.

Generates its own `quoteToken` (`crypto.randomUUID()`) on mount to group any
uploaded photos before the quote request itself is submitted — sent along
with the final submission only if at least one photo was actually uploaded.

## Functions
### `SpecialGoodsQuoteFlow({ locale, onClose })`
