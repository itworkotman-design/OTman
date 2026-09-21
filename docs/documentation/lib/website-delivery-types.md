# `lib/content/websiteDeliveryTypes.ts`

## Purpose
Pure builder for the `Product.deliveryTypes` JSON a website catalog product is seeded with (doorstep, carry-in, installation only, return only; prices rounded to 5 kr). Split out so tests can build the same catalog product without a database.

## Functions
### `buildDeliveryTypesJson(product)`
