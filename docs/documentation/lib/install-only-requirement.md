# `lib/booking/installOnlyRequirement.ts`

## Purpose
"Installation only" with no installation picked is an order for nothing. The website product card auto-selects the first installation option when "Installation only" is picked (`pickDefaultInstallOptionId`) and won't let it be cleared; this is the check behind that.

## Functions
- `findInstallOnlyCardsMissingInstall(cards, products)` — card ids that are `INSTALL_ONLY` but have none of their product's active options in `selectedInstallOptionIds`. Used by `isListConfigured` (the product-options step can't finish) and `POST /api/site/white-goods-order` (422 "Choose which installation you need").
