# `lib/content/websiteDeliveryTypes.ts`

## Purpose
Pure builder for the `Product.deliveryTypes` JSON a website catalog product is seeded with (doorstep, carry-in, installation only, return only; prices rounded to 5 kr). Installation only is seeded with a flat `INSTALL_ONLY_VISIT_PRICE` for every product (609 kr, unrounded; subcontractor 400) and a 0 extra rate. Split out so tests can build the same catalog product without a database.

## Functions
### `buildDeliveryTypesJson(product)`
