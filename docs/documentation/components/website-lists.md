# `app/_components/site/BookingModal/whiteGoods/websiteLists.ts`

## Purpose
Helpers for the per-list steps and the "any other products you need added?" question (which sits at the bottom of the
last list's "product options" step, not as a step of its own).

## Functions
### `filterUnusedLists(available, usedCodes)`
Lists offered for adding: every available list not already used (white goods counts as used).

### `moreProductsHostCode({ chosenCodes, remainingCount, customerLocked })`
The list whose options step holds the "any other products?" question — the last chosen one. Null with no list yet,
nothing left to add, or a locked order.

### `isListOptionsStepComplete({ optionsReady, hostsMoreProducts, declinedMoreProducts })`
Whether a list's options step is done (reveals the steps after it). The step holding the question also waits for
"No, continue to order details"; picking a category instead moves the question to the new list's step.
- A furniture card with an "Other manufacturer" assembly also needs the company named (`findOtherManufacturerCardsMissingName`, see [other-manufacturer.md](../lib/other-manufacturer.md)) before `isListConfigured` is true.
