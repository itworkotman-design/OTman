import { seedWebsiteCatalog } from "@/lib/content/seedWebsiteCatalog";
import { WHITE_GOODS_ELECTRONICS_PRODUCTS } from "@/lib/content/whiteGoodsElectronics";
import { WHITE_GOODS_PRICE_LIST_CODE } from "@/lib/content/WhiteGoodsBookingConfig";

// Seeds the public website's white-goods/electronics delivery+installation
// catalog on its own dedicated PriceList — fully separate from DEFAULT/POWER
// and from the internal dashboard's DISHWASHER/WASHING_MACHINE products, so
// this data never affects pricing for the internal booking flow. Idempotent
// (upsert-based) and side-effect-free beyond this catalog — deliberately
// kept out of prisma/seed.ts's main() (which also resets all company orders)
// so it can be run standalone via `npm run seed:white-goods-catalog`.
export function seedWhiteGoodsElectronics() {
  return seedWebsiteCatalog({
    priceListCode: WHITE_GOODS_PRICE_LIST_CODE,
    priceListName: "Website — White goods / electronics",
    products: WHITE_GOODS_ELECTRONICS_PRODUCTS,
  });
}
