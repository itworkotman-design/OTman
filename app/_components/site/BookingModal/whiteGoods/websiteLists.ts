import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// A website price list the order flow can offer, as returned by the catalog
// API's availableLists.
export type WebsiteListInfo = { code: string; labelEn: string; labelNo: string; iconCode: string };

// "Any other products?" offers every available list except the ones already
// added to the order (the first, white goods, counts as used).
export function filterUnusedLists(available: WebsiteListInfo[], usedCodes: string[]): WebsiteListInfo[] {
  return available.filter((list) => !usedCodes.includes(list.code));
}

// Cards on the order that belong to one list — i.e. whose product is one of
// that list's products.
export function cardsForList(cards: SavedProductCard[], listProducts: CatalogProduct[]): SavedProductCard[] {
  return cards.filter((card) => listProducts.some((product) => product.id === card.productId));
}

// The order without that list's cards (used when a list is removed).
export function removeListCards(cards: SavedProductCard[], listProducts: CatalogProduct[]): SavedProductCard[] {
  return cards.filter((card) => !listProducts.some((product) => product.id === card.productId));
}

// A list is done once it has at least one product and every one of its
// products has a delivery type (each is given one the moment it's added).
export function isListConfigured(cards: SavedProductCard[], listProducts: CatalogProduct[]): boolean {
  const own = cardsForList(cards, listProducts);
  return own.length > 0 && own.every((card) => !!card.productId && !!card.deliveryType);
}
