import { NextResponse } from "next/server";
import { getBookingCatalog } from "@/lib/booking/catalog/getBookingCatalog";
import { getWhiteGoodsPriceListId } from "@/lib/content/WhiteGoodsBookingConfig";
import { WHITE_GOODS_ELECTRONICS_PRODUCTS } from "@/lib/content/whiteGoodsElectronics";

// Public, unauthenticated catalog fetch scoped to exactly one price list
// (the website white-goods catalog) — kept separate from the dashboard's
// /api/booking/catalog (which gates public access behind a single shared
// PUBLIC_CATALOG_PRICELIST_ID env var) so this flow doesn't need to share
// that one-value slot with whatever other public price list may already use
// it, and so that route stays untouched.
const WHITE_GOODS_PRODUCT_CODES = new Set(
  WHITE_GOODS_ELECTRONICS_PRODUCTS.map((p) => p.code),
);

export async function GET() {
  const priceListId = await getWhiteGoodsPriceListId();
  const catalog = await getBookingCatalog(priceListId);

  // getBookingCatalog returns every active Product regardless of price
  // list — only option prices are price-list-scoped — so this filters down
  // to just the white-goods catalog rather than leaking every dashboard
  // product (at 0 kr, since they have no PriceListItem on this list).
  const products = catalog.products.filter((product) =>
    WHITE_GOODS_PRODUCT_CODES.has(product.code),
  );

  return NextResponse.json(
    {
      ok: true,
      priceListId,
      ...catalog,
      products,
    },
    { status: 200 },
  );
}
