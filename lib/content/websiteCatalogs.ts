import { FURNITURE_PRODUCTS, type FurnitureProductSeed } from "@/lib/content/furnitureCatalog";
import {
  FURNITURE_PRICE_LIST_CODE,
  PARCEL_PALLET_PRICE_LIST_CODE,
  WHITE_GOODS_PRICE_LIST_CODE,
} from "@/lib/content/websitePriceListCodes";
import { WHITE_GOODS_ELECTRONICS_PRODUCTS } from "@/lib/content/whiteGoodsElectronics";
import { PARCEL_PALLET_PRODUCTS } from "@/lib/content/parcelPalletCatalog";
import { shortenCatalogCode } from "@/lib/content/shortCatalogCode";

// The price lists a website customer can order from, in the order they're
// offered: the first one is chosen up front and supplies the order-level fees;
// every later one is offered afterwards as "any other products?". Adding a
// catalog here (plus its seed) is all that's needed for it to appear.
export type WebsiteCatalog = {
  priceListCode: string;
  labelEn: string;
  labelNo: string;
  /** Product whose icon stands for the whole category on the first step. */
  iconCode: string;
  products: FurnitureProductSeed[];
};

export const WEBSITE_CATALOGS: WebsiteCatalog[] = [
  {
    priceListCode: WHITE_GOODS_PRICE_LIST_CODE,
    labelEn: "White goods / electronics",
    labelNo: "Hvitevarer / elektronikk",
    iconCode: "WG_WASHING_MACHINE",
    products: WHITE_GOODS_ELECTRONICS_PRODUCTS,
  },
  {
    priceListCode: FURNITURE_PRICE_LIST_CODE,
    labelEn: "Furniture",
    labelNo: "Møbler",
    iconCode: "FN_SOFA",
    products: FURNITURE_PRODUCTS,
  },
  {
    priceListCode: PARCEL_PALLET_PRICE_LIST_CODE,
    labelEn: "Parcel / pallet",
    labelNo: "Pakke / pall",
    iconCode: "PKG_PALL",
    products: PARCEL_PALLET_PRODUCTS,
  },
];

export function getWebsiteCatalog(priceListCode: string): WebsiteCatalog | null {
  return WEBSITE_CATALOGS.find((c) => c.priceListCode === priceListCode) ?? null;
}

export function findWebsiteCatalogByProductCode(productCode: string): WebsiteCatalog | null {
  return WEBSITE_CATALOGS.find((c) => c.products.some((p) => p.code === productCode)) ?? null;
}

export function findWebsiteProductSeed(productCode: string): FurnitureProductSeed | null {
  for (const catalog of WEBSITE_CATALOGS) {
    const product = catalog.products.find((p) => p.code === productCode);
    if (product) return product;
  }
  return null;
}

// Old long option codes (see shortCatalogCode.ts) find their seed too.
export function findWebsiteOptionSeed(productCode: string, optionCode: string) {
  const short = shortenCatalogCode(optionCode);
  return findWebsiteProductSeed(productCode)?.options.find((o) => o.code === short) ?? null;
}

export function remainingWebsiteCatalogs(usedPriceListCodes: string[]): WebsiteCatalog[] {
  return WEBSITE_CATALOGS.filter((c) => !usedPriceListCodes.includes(c.priceListCode));
}
