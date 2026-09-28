# `lib/orders/validateOrderItemEdits.ts`

## Purpose
Server-side gate for the "Forgot something?" customer-facing order editor
(`app/api/public/orders/[token]/edit-items/route.ts`): distinguishes
"reconfigure what you already ordered" (safe to auto-price and
auto-charge — delivery type/addons only) from "add a new item"
(deliberately still staff-mediated). This is the real enforcement, not
just a UI restriction the client-side editor happens to impose — a
hand-crafted or replayed request against the API is checked the same way.

## Functions
- `validateOrderItemEdits(originalCards, submittedCards)` — compares
  submitted product cards against the order's original ones by `cardId`
  and rejects with a specific reason if the card count changed
  (`CARD_COUNT_CHANGED`), a submitted card's id doesn't exist in the
  original order (`UNKNOWN_CARD`), its product was swapped
  (`PRODUCT_CHANGED`), or its quantity changed (`QUANTITY_CHANGED`).
  Anything else (delivery type, addons) is allowed.
