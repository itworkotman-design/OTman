# `app/_components/site/BookingModal/whiteGoods/CustomerTypeStep.tsx`

## Purpose
The very first `StepSection` in both `WhiteGoodsBookingFlow` and
`MovingRequestFlow` (the only two booking modals that show prices) — asks
Privat/Bedrift before anything else, so every price the customer sees for
the rest of the flow (size-tier tiles in Moving, the running-total
calculator in white goods) is already in the right VAT-display mode. This
is the only place the choice is made — there used to also be a
`CustomerTypeToggle` next to the calculator and in the final summary for
correcting it later, but that read as asking the same question twice, so
it was removed; the answer given here is final for the rest of that
booking session. Still display-only — picking an option here never changes
actual pricing, only which of the two already-computed totals leads.

## Functions
### `CustomerTypeStep({ locale, value, onPick })`
Two large tiles (Private/Business), highlighted via `value` once answered
(so the choice stays visible after the section is no longer active);
clicking one calls `onPick` with the chosen `CustomerType`, which the
parent flow uses both to set its `customerType` state and to call the
section's `onComplete` and advance to the next step, mirroring how
`WebsiteListTiles`'s category tiles complete `WhiteGoodsBookingFlow`'s
product-category step.
