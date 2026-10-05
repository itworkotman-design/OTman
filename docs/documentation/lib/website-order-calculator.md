# Website order calculator

## Source

- `lib/orders/websiteOrderCalculator.ts`

## Responsibility

The data behind the calculator in `WebsiteOrderModal`, shown like the booking app's (`CalculatorDisplayNew` + `SubcontractorCalculatorDisplay`). It is built from the same `priceWebsiteOrder` result the order is stored at. Website prices already include VAT, so the customer `total` is what they pay.

## Functions

- `websiteOrderCalculatorView(result, { includePartner })` — every product and order-extras line with its customer and partner price, plus the customer side (subtotal, discount, extra, total) and the partner side (base, minus, plus, total). Without `includePartner`, partner prices are `null` and `partner` is `null`.
- `partnerMinusForDiscount({ rabatt, subtotal, partnerBase })` — the booking app's rule: a discount cuts the partner's pay by the same share (`deriveDiscountSync` without DNB). `""` when there's no discount or no subtotal.

## "Set to 0" choices

Each line carries `lineKey`, `nulledCustomer` and `nulledPartner`; each product carries its `cardId` (`null` for order extras).

- `nulledLinesFromView(view)` — the current choices as `{ cards: { [cardId]: { customer, subcontractor } }, orderExtras: { customer, subcontractor } }`.
- `parseNulledLines(raw)` — validates a save's `nulledLines`; `null` when it is malformed.
- `toggleNulledLine(nulled, target, side, lineKey, on)`: one checkbox click, following the booking app rules. The customer box also sets the partner box; the partner box only sets itself.
- `applyNulledLinesToCards(cards, nulled)` — puts the choices on the product cards. A card the save doesn't list gets none.

## Saving with the modal Save

- `WebsiteOrderPricingDraft`: the calculator unsaved `adjustments` (discount, extra, partner minus/plus) and `nulledLines`.
- `websiteItemsSaveBody(panelHandling, draft, extra?)`: the `PUT /api/orders/[orderId]/website-items` body. It holds the "Handle order" fields, and when there is a draft, also its amounts (merged into `handling`) and `nulledLines`.
