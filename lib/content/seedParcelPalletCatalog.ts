import { seedWebsiteCatalog } from "@/lib/content/seedWebsiteCatalog";
import { PARCEL_PALLET_PRICE_LIST_CODE, PARCEL_PALLET_PRODUCTS } from "@/lib/content/parcelPalletCatalog";

// Seeds the website parcel/pallet catalog on its own WEBSITE_PARCEL_PALLET
// price list. Run standalone via `npm run seed:parcel-pallet-catalog` —
// deliberately not part of prisma/seed.ts's main().
export function seedParcelPalletCatalog() {
  return seedWebsiteCatalog({
    priceListCode: PARCEL_PALLET_PRICE_LIST_CODE,
    priceListName: "Website — Parcel/Pallet",
    products: PARCEL_PALLET_PRODUCTS,
    // Unlike furniture/white goods, this catalog's prices aren't sourced
    // from a spreadsheet — they're staff-entered placeholders (see
    // parcelPalletCatalog.ts). A reseed must never reset them.
    preservePricesOnReseed: true,
    deliveryOnly: true,
  });
}
