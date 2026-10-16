# `lib/orders/serviceOrderCalculator.ts`

## Purpose
A homepage service request in the admin `WebsiteOrderCalculator`: staff's quote line as the "Service" product, express and the
deviation as "Order extras" — `movingOrderCalculatorView` / `movingOrderAdjustedPricing` with their own main group, so the
discount/extra, partner minus/plus and lines set to 0 work exactly as on a move. Tested.

## Exports
- `SERVICE_QUOTE_PRODUCT_CODE` / `SERVICE_QUOTE_OPTION_CODE` — the quote line's codes (the option code is fixed, so a line set
  to 0 stays so when the service changes).
- `SERVICE_ITEM_PRODUCT_CODES` — every line a service request writes (quote, express, deviation).
- `serviceOrderCalculatorView(items, adjustments, { includePartner })` — the calculator view; no lines (0 kr) before quoting.
- `serviceOrderAdjustedPricing(rows, adjustments)` — `{ priceExVat, priceSubcontractor, pricingSnapshot }`.
