import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { findCardsWithSizeBracketProblems, findSizePricedCardsMissingName } from "@/lib/booking/pricing/sizeBrackets";
import { findInstallOnlyCardsMissingInstall } from "@/lib/booking/installOnlyRequirement";
import { findOtherManufacturerCardsMissingName } from "@/lib/booking/otherManufacturer";

// A website price list the order flow can offer, as returned by the catalog
// API's availableLists.
export type WebsiteListInfo = { code: string; labelEn: string; labelNo: string; iconCode: string };

// "Any other products?" offers every available list except the ones already
// added to the order (the first, white goods, counts as used).
export function filterUnusedLists(available: WebsiteListInfo[], usedCodes: string[]): WebsiteListInfo[] {
  return available.filter((list) => !usedCodes.includes(list.code));
}

// The list whose "product options" section also holds the "any other
// products?" question — the last one added — so the question is part of that
// section rather than a step of its own. Null when there's nothing left to
// add, no list yet, or the order is locked ("My order" within 24h).
export function moreProductsHostCode(params: {
  chosenCodes: string[];
  remainingCount: number;
  customerLocked: boolean;
}): string | null {
  if (params.customerLocked || params.remainingCount === 0) return null;
  return params.chosenCodes.at(-1) ?? null;
}

// Whether a list's "product options" step is done, revealing the steps after
// it. The one holding "any other products?" also waits for the customer to
// answer "no, continue" (picking a category instead moves the question to the
// new list's step, which completes this one).
export function isListOptionsStepComplete(params: {
  optionsReady: boolean;
  hostsMoreProducts: boolean;
  declinedMoreProducts: boolean;
}): boolean {
  return params.optionsReady && (!params.hostsMoreProducts || params.declinedMoreProducts);
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
  // Assembly for "another manufacturer" needs the company named.
  // An installation-only item needs its installation picked.
  return (
    own.length > 0 &&
    own.every((card) => !!card.productId && !!card.deliveryType) &&
    findCardsWithSizeBracketProblems(own, listProducts).length === 0 &&
    findSizePricedCardsMissingName(own, listProducts).length === 0 &&
    findOtherManufacturerCardsMissingName(own, listProducts).length === 0 &&
    findInstallOnlyCardsMissingInstall(own, listProducts).length === 0
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
// Other furniture's name, size and weight are asked in its options card, so
// they hold the options step (isListConfigured), not this one.
export function isProductsStepReady({
  ownCount,
  orderCount,
  wasPopulated,
}: {
  ownCount: number;
  orderCount: number;
  wasPopulated: boolean;
}): boolean {
  if (ownCount > 0) return true;
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
