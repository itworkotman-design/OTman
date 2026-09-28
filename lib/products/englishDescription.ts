import { isWebsitePriceList } from "@/lib/products/websitePriceLists";

// The English description (ProductOption.descriptionEn) is only used by the
// public website's order flow, so the edit-prices page shows its column only
// for price lists that are website ones (name contains "Website"). Every
// other booking price list keeps its single, Norwegian description.
export function hasEnglishDescriptionColumn(priceListName: string | null | undefined): boolean {
  return isWebsitePriceList(priceListName);
}
