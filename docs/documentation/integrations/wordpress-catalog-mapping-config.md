# WordPress Catalog Mapping Config

## Source

- `lib/integrations/wordpress/catalogMappingConfig.ts`

## Responsibility

Stores the static alias tables used by the WordPress importer. The file defines which WordPress product names match which native booking products, which generic WordPress install labels map to which native install option codes, which WordPress delivery labels map to native delivery types, and which shared WordPress service labels map to native return or extra-service codes.

## Functions

No functions. This file exports the mapping constants consumed by `lib/integrations/wordpress/catalogMapping.ts`.

## Exports

| Export | Description |
| --- | --- |
| `WORDPRESS_PRODUCT_MAPPINGS` | Product-level mapping definitions that pair native catalog products with WordPress product aliases and product-specific install aliases. |
| `WORDPRESS_DELIVERY_TYPE_ALIASES` | Shared alias table for WordPress delivery labels and native delivery-type keys. |
| `WORDPRESS_SPECIAL_SERVICE_ALIASES` | Shared alias table for WordPress return or extra-service labels and native service codes. |
