# `app/_components/site/BookingModal/whiteGoods/cardSectionVisibility.ts`

## Purpose
Pure predicates deciding whether `WhiteGoodsProductCard`'s "Installation"/"Assembly" step and "Additional services" step have anything to show. Some catalog products (e.g. pakke/pall items) have no install options and no extras/return options — for those the whole step is hidden rather than rendering an empty "No installation" radio or an empty "Additional services" header. When the install step is hidden, the extras step renumbers itself from step 3 to step 2.

## Functions
### `hasInstallStepContent({ assemblyGroupCount, typeOptionCount, hasNeedsImplementationNote, deliveryType })`
True if the product has furniture assembly groups, install type options, or a pending-implementation note to show. Always false for doorstep delivery (`deliveryType === "FIRST_STEP"`) — installation/assembly isn't offered there. Still shown before any delivery type is picked.

### `hasExtrasStepContent({ showExtras, showReturn, furnitureAddonsVisible, isFurniture, installSelected, hasUnpackingOption, hasDemontOption, dismantlingGroupCount, hasAnchoringOption, hasReturnOption })`
True if any individual row in the "Additional services" step (unpacking, dismantling, demont, wall anchoring, return) would actually render.

### `showsNoInstallOption(deliveryType)`
False for an installation-only card (`INSTALL_ONLY`) — the "No installation" row is hidden there, since that card exists for the installation.

### `offersCarryIn(deliveryTypes)`
False when the product's `INDOOR` delivery type is disabled (pallets, half-pallets), so the card hides the carry-in row. A product with no `INDOOR` entry keeps offering it.
