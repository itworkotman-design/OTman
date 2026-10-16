# `lib/orders/serviceOrderCalculator.ts`

## Purpose
A homepage service request in the admin `WebsiteOrderCalculator`: staff's quote lines (one per service) as the "Service"
product, express and the deviation as "Order extras" — `movingOrderCalculatorView` / `movingOrderAdjustedPricing` with their
own main group, so the discount/extra, partner minus/plus and lines set to 0 work exactly as on a move. Tested.

## Exports
- `SERVICE_QUOTE_PRODUCT_CODE` — the quote lines' product code.
- `serviceQuoteOptionCode(serviceCode)` — a quote line's option code, `QUOTE:<serviceCode>`, so each service's line can be
  set to 0 on its own. `LEGACY_SERVICE_QUOTE_OPTION_CODE` (`QUOTE`) is the single line of a request stored before services
  were a list.
- `SERVICE_ITEM_PRODUCT_CODES` — every line a service request writes (quotes, express, deviation).
- `serviceOrderCalculatorView(items, adjustments, { includePartner })` — the calculator view; no lines (0 kr) before quoting.
- `serviceOrderAdjustedPricing(rows, adjustments)` — `{ priceExVat, priceSubcontractor, pricingSnapshot }`.
