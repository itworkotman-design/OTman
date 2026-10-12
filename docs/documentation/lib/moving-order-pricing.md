# Moving order pricing

## Source

- `lib/orders/movingOrderPricing.ts`

## Responsibility

The price of a homepage moving request (`POST /api/site/moving-request`). The moving price list's size-bracket price is ex. VAT, like every website price. The order stores it as `priceExVat`, with the partner price as `priceSubcontractor`. Its `pricingSnapshot` (built with `buildOrderPricingSnapshot`'s `customerTotalIncVat`) keeps what the customer pays: the price +25%, rounded to whole kroner (`websiteInclVat`). So the payment link (`getOrderChargeAmountIncVatNok`) charges exactly what `MovingRequestFlow` showed.

## Functions

- `movingOrderPricing(sizeOption)` — `{ priceExVat, priceSubcontractor, pricingSnapshot }`.
