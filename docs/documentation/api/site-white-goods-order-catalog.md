# `app/api/site/white-goods-order/catalog/route.ts`

## Purpose
Public, unauthenticated GET endpoint behind `WhiteGoodsBookingFlow.tsx`'s product
steps. Each request is scoped to one website price list (`?list=<price list code>`,
default: the first, white goods). It is kept separate from the dashboard's
`/api/booking/catalog`. The order-level fees and special options always come from
the first seeded list, the same rule the order route applies when it merges lists.

## Functions
- `GET` — `{ ok, priceListCode, priceListId, products, specialOptions, priceListSettings, availableLists, payAtBooking }`,
  or `404 UNKNOWN_LIST` for a code that isn't a seeded website list.
  - `availableLists` — the seeded website lists, in offer order, with bilingual labels
    (drives "any other products?").
  - `payAtBooking` — true in Stripe mode (`HOMEPAGE_PAYMENT_MODE=stripe`): submitting
    goes straight to checkout, so the flow's submit button reads "Betal" instead of
    "Send bestilling".
