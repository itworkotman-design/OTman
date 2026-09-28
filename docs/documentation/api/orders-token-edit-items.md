# `app/api/public/orders/[token]/edit-items/route.ts`

## Purpose
The "Forgot something?" self-service editor for an already-paid website
order — the customer-facing counterpart to staff-mediated order editing.
Unlike `orders-token-request-change.md` (a free-text message, still
staff-mediated for anything not covered here), this route lets the customer
directly reconfigure an existing product's delivery type and addon
selections and pay any price increase themselves, with no staff approval
step — safe to auto-price/auto-charge because it can only pick among
already-known catalog prices for products already in the order. It can
never add/remove a product, swap which product a card refers to, or change
quantity; `validateOrderItemEdits` enforces that server-side.

Only offered when the order is `"confirmed"` **and** has a
`productCardsSnapshot` (i.e. it went through the catalog-priced website
booking flow — Moving/special-goods/services orders have neither, so this
route is simply unavailable for them, not an error).

A change that would decrease the total is rejected outright (`422
WOULD_DECREASE_PRICE`) — refunding a partial payment is a different,
unbuilt feature.

## Functions
- `GET` — fetches the order's current product cards and the live catalog,
  so the client can render each product's choices with current prices (not
  whatever was frozen in the order's `pricingSnapshot` at original booking
  time).
- `recomputeOrderPricing` (internal) — re-runs the exact same pricing
  pipeline `app/api/site/white-goods-order/route.ts` uses to create an
  order, against the submitted cards, preserving the order's own
  driving-distance/express-delivery/floor/lift/extra-pickup context (the
  customer isn't resubmitting addresses here).
- `POST` — validates the submitted cards via `validateOrderItemEdits`,
  recomputes pricing, rejects a decrease, otherwise persists the new
  `productCardsSnapshot`/`pricingSnapshot`/totals and replaces the order's
  `OrderItem` rows in one transaction, logs an `OrderUpdatedEvent`, and
  raises a `MANUAL_REVIEW` notification alerting staff. The customer then
  pays the delta via the existing top-up flow at `/betaling/[token]`
  (`isTopUpPayable`).
