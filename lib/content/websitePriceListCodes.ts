// Client-safe (no database import) so the website order UI can use these.
// Matches the PriceList.code values seeded by the website catalog seeds.
export const WHITE_GOODS_PRICE_LIST_CODE = "WEBSITE_WHITE_GOODS";
export const FURNITURE_PRICE_LIST_CODE = "WEBSITE_FURNITURE";
// Not in WEBSITE_CATALOGS (lib/content/websiteCatalogs.ts) — Moving is a flat
// "pick one size bracket" price, not a multi-select product-card catalog like
// white goods/furniture, so it doesn't plug into that merged-cart flow. Fetched
// directly by this code from its own small public route instead — see
// app/api/site/moving-request/catalog/route.ts.
export const MOVING_PRICE_LIST_CODE = "WEBSITE_MOVING";
