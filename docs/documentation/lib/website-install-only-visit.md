# `lib/booking/pricing/websiteInstallOnlyVisit.ts`

## Purpose
Website flow only. "Installation/assembly only" (`INSTALL_ONLY`) is still a trip to the customer, with its own price in `Product.deliveryTypes` — seeded as a flat 609 kr (subcontractor 400) with a 0 extra rate (`INSTALL_ONLY_VISIT_PRICE` in `lib/content/websiteDeliveryTypes.ts`), editable per product in Booking → Edit prices ("Install only price").

The pricing itself happens in the shared code with `installOnlyVisitPricing: true` (passed to `buildProductBreakdowns`, `buildOrderItemsFromCards` and `getAutomaticXtraDeliveryCardIds` by the booking flow, `POST /api/site/white-goods-order` and the public edit-items route): an install-only card competes for the order's one full-price slot at its own price, highest wins, ties go to the earlier card. As the full-price card it pays its price; as an extra card it pays its extra rate (0). A delivery it outprices drops to its extra rate. Dashboard pricing (no flag) is unchanged.

Example: carry-in 690 + install-only 609 → carry-in is the full-price card, install-only free: 690. Doorstep (610) also outranks install-only (609).

## Functions
- `applyWebsiteInstallOnlyVisit(breakdowns, cards, products)` — keeps the `INSTALL_ONLY` code on install-only lines (the shared pricing codes extra ones as `XTRA`), so the order summary shows free ones blank instead of "Included".
- `previewInstallOnlyVisitPrice(cards, products, cardId)` — the "installation only" option's price: the install-only price on the full-price card, `null` (shown as nothing) on extra cards. Used by `deliveryPricePreview.ts`.
