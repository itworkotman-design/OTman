import type {
  CatalogProduct,
  CatalogSpecialOption,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { PriceListSettings } from "@/lib/products/priceListSettings";

export type WebsiteCatalogPart = {
  priceListId: string;
  products: CatalogProduct[];
  specialOptions: CatalogSpecialOption[];
  priceListSettings: PriceListSettings;
};

export type MergedWebsiteCatalog = WebsiteCatalogPart & { priceListIds: string[] };

// Combines several website price lists into the single catalog the one shared
// calculator prices from. Products from every list are concatenated (option
// prices are already per-list, so each product keeps its own list's prices);
// the price list id, special options and order-level fees (express, distance,
// floor, extra pickup) are taken from the FIRST list only — for now they're
// identical across lists, and if that changes this is the one place to
// change it.
export function mergeWebsiteCatalogs(parts: WebsiteCatalogPart[]): MergedWebsiteCatalog {
  const [first] = parts;
  if (!first) throw new Error("Cannot merge zero website catalogs");

  const seen = new Set<string>();
  const products: CatalogProduct[] = [];
  for (const part of parts) {
    for (const product of part.products) {
      if (seen.has(product.id)) {
        throw new Error(`Product ${product.id} appears in more than one website price list`);
      }
      seen.add(product.id);
      products.push(product);
    }
  }

  return {
    priceListId: first.priceListId,
    priceListIds: parts.map((p) => p.priceListId),
    products,
    specialOptions: first.specialOptions,
    priceListSettings: first.priceListSettings,
  };
}

// Product ids on the order's cards that aren't sold on the website — the order
// route rejects these so a crafted request can't price (or order) a dashboard-
// only product through the public flow.
export function findUnsellableProductIds(
  cards: Array<{ productId: string | null }>,
  catalogProducts: CatalogProduct[],
): string[] {
  const sellable = new Set(catalogProducts.map((p) => p.id));
  return cards.filter((c) => !c.productId || !sellable.has(c.productId)).map((c) => c.productId ?? "");
}
