# `app/_components/site/BookingModal/whiteGoods/deliveryCascade.ts`

The homepage booking flow's "set delivery for the whole list" rule. With several
products in one price list, changing the delivery type on that list's **first**
card (e.g. doorstep → carry-in) gives the list's other cards the same delivery
type, so carrying everything in is one click.

It only happens when:

- it's a new order (not "Min bestilling" — `WhiteGoodsBookingFlow` skips it with
  `customer` set),
- the change is on the list's first card (first in card order among the list's
  products; another list's cards before it don't count),
- none of the list's **other** cards has been edited yet — any choice made on one
  (delivery, installation, extras, return, size/name) blocks it; edits to the first
  card itself or to another list's cards don't,
- it hasn't already run for that list (once per list — switching the first card
  back afterwards changes only that card).

A product that doesn't offer the delivery type keeps its own (e.g. a pallet
without carry-in). Installation only cascades too, to products that offer it,
each starting with its first installation.

## Exports

- `cardWithDeliveryType(card, product, next, locale)` — a card switched to
  another delivery type exactly as picking it on the card does: add-ons cleared
  (the item's size/weight kept), installation only starts with the product's
  first installation. `WhiteGoodsProductCard`'s delivery picker uses it too, so
  the two can't drift apart.
- `cascadeFirstCardDelivery({ cards, changedCardId, listProducts, editedCardIds, locale })`
  — the cards with the cascade applied (the first card's change already in
  `cards`), or `null` when it doesn't apply.

## State in `WhiteGoodsBookingFlow`

`editedCardIds` — cards the customer has changed something on (`updateCard`, and
the size picker's name/size/weight). `deliveryCascadedListCodes` — lists the
cascade has run for.
