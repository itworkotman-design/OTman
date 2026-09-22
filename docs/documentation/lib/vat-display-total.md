# `lib/booking/pricing/vatDisplayTotal.ts`

## Purpose
Display-only helper backing the Privat/Bedrift toggle in the website booking
flow (`WhiteGoodsBookingFlow`/`WhiteGoodsOrderSummary`). Decides which of an
already-computed ex-VAT/incl-VAT total pair is shown large/primary vs.
small/secondary — private customers see incl.-VAT primary (what they pay),
business customers see ex-VAT primary (what they reclaim). Never changes
pricing, eligibility, or the catalog — both totals are always computed by
`lib/booking/pricing/engine.ts` regardless of customer type; this only picks
which one leads.

## Functions
- `getVatDisplayTotal({ totalExVat, totalIncVat, customerType? })` — returns
  `{ primary: "incVat" | "exVat", primaryAmount, secondaryAmount }`.
  `customerType` defaults to `"private"`.
