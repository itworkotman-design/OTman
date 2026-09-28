# `app/_components/site/BookingModal/specialGoods/SpecialGoodsQuoteFlow.tsx`

## Purpose
The homepage's 5th "Book a service" tile ("Spesialvarer"/Special goods),
wired in `ServiceWindow.tsx` via `SPECIAL_GOODS_SERVICE_ID`. Built on the
same `SteppedModal` shell as Moving, with no pricing engine — a quote
request, not a priced booking. 4 sections: item details (description +
optional dimension picker, mined from the dead `ServiceModal.tsx` per the
step-1 plan — see `docs/homepage-ordering-roadmap.md` §3a), photos (up to
`MAX_QUOTE_PHOTOS`, held client-side only — see below), pickup/delivery, and
contact details (with a honeypot field). Submits to
`POST /api/site/special-goods-quote`.

Generates its own `quoteToken` (`crypto.randomUUID()`) on mount to group any
uploaded photos before the quote request itself is submitted — sent along
with the final submission only if at least one photo was actually uploaded.

**Photos upload only at final submit, not as each one is picked.** Selected
photos are held in memory as plain `File` objects (`PendingPhoto`); removing
one before submitting is purely local state (no network call). On "Request a
quote", `uploadPhotosBeforeSubmit` uploads each to
`app/api/site/special-goods-quote/upload/route.ts` in turn — if any fails,
submission stops there rather than creating an order with a partial photo
set. This means someone who picks photos and never finishes the form never
writes anything to S3/the DB — deliberate, so there's no cleanup job needed
for that (previously real) source of orphaned uploads.

## Functions
### `SpecialGoodsQuoteFlow({ locale, onClose })`
