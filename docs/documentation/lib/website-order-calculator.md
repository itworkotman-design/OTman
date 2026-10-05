# Website order calculator

## Source

- `lib/orders/websiteOrderCalculator.ts`

## Responsibility

The data behind the calculator in `WebsiteOrderModal`, shown like the booking app's (`CalculatorDisplayNew` + `SubcontractorCalculatorDisplay`). It is built from the same `priceWebsiteOrder` result the order is stored at. Website prices already include VAT, so the customer `total` is what they pay.

## Functions

- `websiteOrderCalculatorView(result, { includePartner })` — every product and order-extras line with its customer and partner price, plus the customer side (subtotal, discount, extra, total) and the partner side (base, minus, plus, total). Without `includePartner`, partner prices are `null` and `partner` is `null`.
- `partnerMinusForDiscount({ rabatt, subtotal, partnerBase })` — the booking app's rule: a discount cuts the partner's pay by the same share (`deriveDiscountSync` without DNB). `""` when there's no discount or no subtotal.
