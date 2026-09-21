# `lib/booking/pricing/websiteAssemblyExtras.ts`

## Purpose
Website furniture only: dismantling and wall anchoring can be booked together with assembly, but the shared pricing drops every "extra" once an install option is selected. This layer prices those two kinds of extra (unpacking stays dropped — it is included in assembly; white goods unaffected).

## Functions
- `isAssemblyCompatibleExtraCode(code)` — `DISMANTLE_*` or `WALL_ANCHORING`.
- `applyWebsiteAssemblyExtras(breakdowns, cards, products)` — adds them to the pricing breakdown.
- `buildWebsiteAssemblyExtraOrderItems(cards, products)` — the same as saved order lines.
