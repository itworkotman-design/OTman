# `app/_components/site/BookingModal/whiteGoods/cardSectionVisibility.ts`

## Purpose
Pure predicates deciding whether `WhiteGoodsProductCard`'s "Installation"/"Assembly" step and "Additional services" step have anything to show. Some catalog products (e.g. pakke/pall items) have no install options and no extras/return options — for those the whole step is hidden rather than rendering an empty "No installation" radio or an empty "Additional services" header. When the install step is hidden, the extras step renumbers itself from step 3 to step 2.

## Functions
### `hasInstallStepContent({ assemblyGroupCount, typeOptionCount, hasNeedsImplementationNote })`
True if the product has furniture assembly groups, install type options, or a pending-implementation note to show.

### `hasExtrasStepContent({ showExtras, showReturn, furnitureAddonsVisible, isFurniture, installSelected, hasUnpackingOption, hasDemontOption, dismantlingGroupCount, hasAnchoringOption, hasReturnOption })`
True if any individual row in the "Additional services" step (unpacking, dismantling, demont, wall anchoring, return) would actually render.
