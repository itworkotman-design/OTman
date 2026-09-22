# `app/_components/site/BookingModal/whiteGoods/CustomerTypeToggle.tsx`

## Purpose
Small Privat/Bedrift (private/business) segmented-control toggle rendered
inside `WhiteGoodsOrderSummary` (sticky per-step sidebar) and the
`WhiteGoodsBookingFlow` final summary step. Purely sets which customer type
is active; the actual display switch happens via
`lib/booking/pricing/vatDisplayTotal.ts`'s `getVatDisplayTotal`.

## Functions
### `CustomerTypeToggle({ locale, value, onChange })`
Controlled component — state (`customerType`) lives in the parent
(`WhiteGoodsBookingFlow`) so both places that render pricing stay in sync.
