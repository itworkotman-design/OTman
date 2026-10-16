# `app/api/orders/[orderId]/service-details/route.ts`

## Purpose
`PUT` — the admin's edit of a homepage service request (WebsiteOrderModal, `websiteOrderKind: "SERVICE"`). Same API and
access as `moving-details` (owner/admin or Website orders at ADMIN level). Tested.

- `edit` (a `ServiceEdit`: `address` and `services: [{ serviceCode, customService, jobDescription, quote: { customer,
  partner } }]`, prices in kroner ex. VAT, `null` = not priced) — validated by `parseServiceEdit`; writes the answers,
  `deliveryAddress`, `productsSummary`, the description staff read (`serviceOrderSaveData`) and one `SERVICE_QUOTE` line
  per quoted service (`QUOTE:<serviceCode>`). Refused (409) on cancelled/completed/invoiced/paid orders.
- `customer`, `preferredDate`, `timeWindow`, `customerType` — as on a move (a customer type alone also rewrites the
  description's "Customer type" line).
- `handling` — the "Handle order" panel's fields and the calculator's discount/extra and partner minus/plus. Express and the
  deviation become the order's own lines, priced from the moving price list's settings (`movingHandlingItemRows`, the same
  line codes a move uses) and kept as priced when the quote changes. `nulledLines` ("Set to 0") is stored on the snapshot.
- `dryRun` — the price, the paid-vs-now `comparison` and `calculator` (`serviceOrderCalculatorView`) without saving.
Lines are replaced in a transaction (`SERVICE_ITEM_PRODUCT_CODES`). No catalog, so no `useCurrentPrices`. Status and partner
save through `/api/orders/bulk`. Changes are logged on the order's history.
