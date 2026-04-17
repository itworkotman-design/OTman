# `lib/orders/buildOrderSummaries.ts`

## Purpose
Builds compact summary strings for products, delivery types, and selected services on an order.

## Functions
### `getCardCount(card, product)`
Returns the effective quantity for one product card. Products without quantity support always count as `1`.

### `incrementLabelCount(counts, label, amount)`
Adds a label to an ordered count map and increases its total by the provided amount.

### `formatCountSummary(counts)`
Formats counted labels into a readable summary string such as `Washer x4, Dryer`.

### `getOptionText(option)`
Returns the best available display text for an option by preferring `description`, then `label`, then `code`.

### `buildOrderSummaries(productCards, catalogProducts, catalogSpecialOptions)`
Builds `productsSummary`, `deliveryTypeSummary`, and `servicesSummary` for an order. Duplicate product and delivery-type labels are collapsed into counted entries while service selections remain listed individually.
