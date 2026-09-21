# `lib/content/mergeWebsiteCatalogs.ts`

## Purpose
Pure helpers for combining website price lists into the single catalog the one shared calculator prices from.

## Functions
### `mergeWebsiteCatalogs(parts)`
Concatenates products (throws on a duplicate product id); price list id, special options and order-level fees come from the FIRST list only.

### `findUnsellableProductIds(cards, catalogProducts)`
Card product ids not in the website catalog — the order route rejects these.
