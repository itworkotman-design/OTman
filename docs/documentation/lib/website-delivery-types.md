# `lib/content/websiteDeliveryTypes.ts`

## Purpose
Pure builder for the `Product.deliveryTypes` JSON a website catalog product is seeded with (doorstep, carry-in, installation only, return only; customer prices via `websiteSeedCustomerPrice`, i.e. 5 kr then up to a multiple of 8 so they end in 0 incl. VAT; partner prices rounded to 5 kr). Installation only is seeded with a flat `INSTALL_ONLY_VISIT_PRICE` for every product (608 kr = 760 incl. VAT, just under doorstep's 616; subcontractor 400) and a 0 extra rate. Split out so tests can build the same catalog product without a database.

## Functions
### `buildDeliveryTypesJson(product)`
Carry-in (`INDOOR`) is `enabled: false` when the seed sets `deliveryTypes.indoorEnabled: false` (pallets).

### `mergePreservedDeliveryTypes(stored, seeded)`
For a reseed with `preservePricesOnReseed`:
- **Prices:** stored prices are kept unless all four are 0, in which case they are an unfilled placeholder and the seed's prices are used.
- **Enabled:** a delivery type stays enabled only if both the stored and the seeded entry are enabled.
- **Nothing usable stored:** the seed is returned as is.
