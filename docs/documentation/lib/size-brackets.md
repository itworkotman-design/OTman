# `lib/booking/pricing/sizeBrackets.ts`

## Responsibility
Volume (m³) and weight (kg) "size brackets" for products priced by how big /
heavy the item is — website furniture **Other furniture** (`FN_OTHER_FURNITURE`).
Each bracket is an ordinary `ProductOption` (so staff set its price per price
list in `/dashboard/booking/editPrices`) whose `category` is `size_volume` or
`size_weight`. The customer picks exactly one of each; the charge added on top
of the flat delivery price is the **higher** of the two brackets' prices (light
but bulky → volume; small but heavy → weight).

Selections are stored in `SavedProductCard.selectedExtraOptionIds` and
recognised by option category — no card/schema change. Both brackets stay on
the card and the order items (staff/drivers need the real size and weight);
only the chargeable one has a price, the other is **waived** (priced 0).

> **Update:** the customer no longer picks the volume bracket. They choose
> width / height / length from preset choices and the volume is **calculated**
> from them (`sizeDimensions.ts`, see `size-dimensions.md`); the volume bracket
> is derived from that m³ (server-side too). They still pick the weight bracket.

## The item's name ("What is it?")
A size-priced product is a catch-all, so the customer must also say what the item
is: a short free-text name (max `MAX_ITEM_NAME_LENGTH` = 80) kept in the card's
existing `modelNumber` — already carried into order items, summaries and the
dashboard, so no schema change. Enforced server-side
(`findSizePricedCardsMissingName` + the shared `validateTextField` character
rules; stored trimmed): `app/api/site/white-goods-order` → 422 "Say what the item
is…", the "My order" edit → 422 `ITEM_NAME_REQUIRED`. `buildOrderSummaries` shows it as
`Other furniture (Grandfather clock)` in the products summary. The tile has a
"What is it?" input, and the products step / list gate need the name too. In the
order calculator (sidebar + final summary) the product is titled with that name
behind a prefix — "A.M: Fish" (A.M = Andre møbler; `whiteGoods/productDisplayName.ts`,
not translated; another size-priced product would use its own label as the prefix).

## Functions
- `isSizeBracketCategory(category)`
- `splitSizeBracketOptionIds(product, ids)` → `{ sizeIds, otherIds }`
- `resolveSizeBracketCharge(product, selectedIds)` → `{ chargeableId, waivedIds }`
  (highest effective customer price; tie → volume)
- `getSizeBracketProblems(product, selectedIds)` — categories the product offers
  (active options) that have no / more than one selection
- `findCardsWithSizeBracketProblems(cards, products)` → card ids
- `isSizePricedProduct(product)`, `findSizePricedCardsMissingName(cards, products)`,
  `MAX_ITEM_NAME_LENGTH`

## Used by (all must agree)
- `fromProductCards.ts` (`buildItemsForCard`) — totals; waived bracket gets
  `priceOverride: 0`. Priced independently of the extras gate.
- `orders/buildOrderItemsFromCards.ts` — stored order items (waived → 0 cents).
- `orders/buildOrderSummaries.ts` — the chosen brackets are always listed.
- Enforcement: `app/api/site/white-goods-order` (422 if a brackets is missing /
  duplicated — else the surcharge could be dodged by not choosing) and
  `app/api/customer/orders/[orderNumber]` (422 `SIZE_BRACKETS_REQUIRED`).
- UI: the "Choose products" grid is just tiles with a quantity stepper. The
  name, size and weight are the **last section of the product's options card**
  (`WhiteGoodsProductCard`'s `belowOptions`), after Delivery / Installation /
  Extras. The picker is `whiteGoods/SizeBracketPicker.tsx` (`embedded`, its
  step numbers carrying on via `firstStep`): the item's name, width / height /
  length as tappable chips with a live computed volume, weight bracket cards, then
  an "Added to delivery" line showing the higher price and whether size or weight
  set it. The same card is used by the customer's booking flow and the admin
  "Edit order" tab. Choices are applied by `whiteGoods/sizeBracketSelection.ts`
  (`applySizeDimension`, `applySizeBracketSelection`, `applyItemName`), and
  changing the delivery type keeps them. The options step only completes once all
  three are chosen (`isListConfigured`), and submit stays gated as a safety net.
  Within 24h of the job the customer's "My order" editor hides the section (a
  size change then is staff-mediated).
