import { seedWebsiteCatalog } from "@/lib/content/seedWebsiteCatalog";
import { FURNITURE_PRICE_LIST_CODE, FURNITURE_PRODUCTS } from "@/lib/content/furnitureCatalog";

// Seeds the website furniture catalog on its own WEBSITE_FURNITURE price list.
// Run standalone via `npm run seed:furniture-catalog` — deliberately not part
// of prisma/seed.ts's main() (which also resets company orders).
export function seedFurnitureCatalog() {
  return seedWebsiteCatalog({
    priceListCode: FURNITURE_PRICE_LIST_CODE,
    priceListName: "Website — Furniture",
    products: FURNITURE_PRODUCTS,
  });
}
