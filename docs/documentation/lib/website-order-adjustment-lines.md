# Website Order Adjustment Lines

## Source

- `lib/orders/websiteOrderAdjustmentLines.ts`

## Responsibility

Lets the website order save routes (`website-items`, `moving-details`, `service-details`) take the calculator's adjustment lines, the booking app's system (`lib/booking/pricing/adjustmentLines`). The routes keep pricing from the four summed fields (`rabatt`, `leggTil`, `subcontractorMinus`, `subcontractorPlus`), unchanged. The lines only add the breakdown, stored in `pricingSnapshot.adjustmentLines` like a regular order's and read back with `storedAdjustmentLines` (`website-details`).

## Functions

| Function | Description |
| --- | --- |
| `readSubmittedAdjustmentLines(body)` | Without `adjustmentLines`, returns the body's `handling` unchanged with `lines: null`. With them, validates them (`parseAdjustmentLines`; not a list → `{ ok: false }`, and the routes answer 400 `INVALID_BODY`) and lays their per-kind sums over `handling`, so the stored fields always add up to the stored lines. |
| `withAdjustmentLines(snapshot, lines)` | The pricing snapshot a save writes, with `adjustmentLines` set and the rest kept. |
