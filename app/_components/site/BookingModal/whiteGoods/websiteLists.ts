import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { findCardsWithSizeBracketProblems, findSizePricedCardsMissingName } from "@/lib/booking/pricing/sizeBrackets";

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
  // Size-priced products (Other furniture) also need their size and weight
  // chosen, and a name saying what the item is, before the step counts as done.
  return (
    own.length > 0 &&
    own.every((card) => !!card.productId && !!card.deliveryType) &&
    findCardsWithSizeBracketProblems(own, listProducts).length === 0 &&
    findSizePricedCardsMissingName(own, listProducts).length === 0
  );
}

// Step readiness for a list's "choose products" and "product options" steps.
//
// A list with its own products is judged on them. A list that HAD products and
// was later emptied (e.g. the only white good got unticked while furniture is
// still on the order) must not hold the order back — otherwise its steps stop
// counting as done and every step after them collapses, taking the other
// list's selection with them. A list that never had products (just added) still
// waits for its first one, and an order with nothing in it waits everywhere.
//
// sizeBracketsComplete: false while a size-priced product on this list (Other
// furniture) still has no volume/weight chosen — its tile asks for them, and
// the step only finishes (moving on to the options) once they are. Omitted for
// lists that have nothing to choose.
export function isProductsStepReady({
  ownCount,
  orderCount,
  wasPopulated,
  sizeBracketsComplete = true,
}: {
  ownCount: number;
  orderCount: number;
  wasPopulated: boolean;
  sizeBracketsComplete?: boolean;
}): boolean {
  if (ownCount > 0) return sizeBracketsComplete;
  return wasPopulated && orderCount > 0;
}

export function isOptionsStepReady({
  ownCount,
  configured,
  orderCount,
  wasPopulated,
}: {
  ownCount: number;
  configured: boolean;
  orderCount: number;
  wasPopulated: boolean;
}): boolean {
  return ownCount > 0 ? configured : wasPopulated && orderCount > 0;
}

// Readiness of one list's "product options" step, judged on that list's own
// cards only. Size-priced items on ANOTHER list (a freshly picked Other
// furniture with no size/weight yet) must not count: this step's readiness
// flipping false retracts every step after it, which would collapse the very
// step the customer is filling in.
export function isListOptionsStepReady({
  cards,
  listProducts,
  wasPopulated,
}: {
  cards: SavedProductCard[];
  listProducts: CatalogProduct[];
  wasPopulated: boolean;
}): boolean {
  return isOptionsStepReady({
    ownCount: cardsForList(cards, listProducts).length,
    configured: isListConfigured(cards, listProducts),
    orderCount: cards.length,
    wasPopulated,
  });
}

// The list to show as "the one we started with" on the first step: the first
// chosen list that still has products (so emptying white goods while furniture
// remains makes furniture the start), else simply the first chosen list.
export function highlightedStartList(
  chosenCodes: string[],
  cards: SavedProductCard[],
  productsByList: Record<string, CatalogProduct[]>,
): string | null {
  const withProducts = chosenCodes.find((code) => cardsForList(cards, productsByList[code] ?? []).length > 0);
  return withProducts ?? chosenCodes[0] ?? null;
}
