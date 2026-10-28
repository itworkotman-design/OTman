# Adjustment Lines

## Source

- `lib/booking/pricing/adjustmentLines.ts`

## Responsibility

Models the calculator's manual adjustments as a list of lines, each with a kind (`discount`, `extra`, `subcontractorMinus`, `subcontractorPlus`), a description and a positive amount, so discounts (and the other adjustments) can be added multiple times with their own description. The lines are stored in `Order.pricingSnapshot.adjustmentLines`; the legacy single-value Order fields `rabatt`/`leggTil`/`subcontractorMinus`/`subcontractorPlus` are kept as the per-kind sums so totals, GSM, archive columns and integrations keep reading them unchanged.

## Functions

| Function | Description |
| --- | --- |
| `createAdjustmentLineId` | Creates a unique id for a new line. |
| `sumAdjustmentLines` | Sums lines per kind into the four legacy adjustment strings (empty string for zero). |
| `parseAdjustmentLines` | Sanitizes untrusted input (request body / stored snapshot); returns `null` when the value is not an array. |
| `adjustmentLinesFromLegacy` | Turns each non-zero legacy field into one undescribed line, for orders/templates saved before lines existed. A negative legacy value (prod has e.g. `leggTil -890` used as a discount, `subcontractorPlus -540` used as a partner minus) becomes a line of the opposite kind with the same net effect; unparseable values count as 0, as in the old engine. |
| `adjustmentLinesForView` | Lines a viewer may see: customer/order creator → discount + extra, partner → minus + plus (never the customer's discount); zero-amount lines dropped. |
| `storedAdjustmentLines` | Returns the stored lines only if they still add up to the stored fields (bulk edit, GSM webhook and cancelled cleanup change the fields directly), otherwise falls back to legacy lines. |
| `resolveOrderAdjustments` | Server-side resolution for a save: submitted lines win and the summed fields are re-derived from them; field-only callers get legacy lines; a save touching no adjustments keeps the existing lines. |
| `addAdjustmentLine` | Appends an empty line of a kind; a discount also gets an empty linked partner minus line. |
| `updateAdjustmentLine` | Applies a description/amount/percent edit or a NOK ⇄ % unit switch (converting the current value; subtracting kinds are capped at 100 %; `amount` always holds the NOK result and `percent` is kept for display/re-editing), copies a discount's description to its linked partner minus, unlinks a partner minus once its amount is edited by hand, then re-syncs all linked partner minus lines. |
| `adjustmentLineBase` | What a percentage line is a percentage of: the running total on its side before this line — products plus every other line on that side (extras / partner plus added, discounts / partner minus subtracted); a line never counts towards its own base. |
| `unlinkAdjustmentLines` | Turns linked partner minus lines into independent ones (all, or those of one discount). Called when a discount is applied and when a saved order loads, so the partner minus only follows its discount during initial setup. |
| `removeAdjustmentLine` | Removes a line (and any partner minus linked to it), then re-syncs linked partner minus lines. |
| `syncLinkedMinusLines` (internal) | Gives each linked partner minus the same percentage cut as its discount: `discount / adjustmentLineBase(discount)` applied to `adjustmentLineBase(partner minus)`. A % discount's partner minus also carries that percent, so partners see e.g. "Minus (25 %)". |
| `proportionalSubcontractorMinus` | Scales a customer discount by the partner/customer subtotal ratio, for the auto-added partner minus line. |
