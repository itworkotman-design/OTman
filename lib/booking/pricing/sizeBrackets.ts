// "Size brackets" — the volume (m³) and weight (kg) choices for products that
// are priced by how big / heavy the item is (website furniture "Other
// furniture"). Each bracket is an ordinary ProductOption (so staff set its
// price per price list in /dashboard/booking/editPrices) whose category marks
// it as a volume or weight bracket. The customer picks exactly one of each; the
// price added on top of the delivery price is the HIGHER of the two — a light
// but bulky item is charged by volume, a small but heavy one by weight.
//
// Both brackets stay on the card / order items (staff and drivers need the real
// weight and volume), but only the chargeable one carries a price: the other is
// "waived" (priced 0). This module is the one place that decides which is
// which, so the two pricing engines (fromProductCards for totals,
// buildOrderItemsFromCards for stored line items) can't disagree.
//
// Selections live in SavedProductCard.selectedExtraOptionIds and are recognised
// by option category, so no card/schema shape had to change.

export const SIZE_VOLUME_CATEGORY = "size_volume";
export const SIZE_WEIGHT_CATEGORY = "size_weight";
export const SIZE_BRACKET_CATEGORIES = [SIZE_VOLUME_CATEGORY, SIZE_WEIGHT_CATEGORY] as const;
export type SizeBracketCategory = (typeof SIZE_BRACKET_CATEGORIES)[number];

type SizeOptionLike = {
  id: string;
  category: string | null;
  active: boolean;
  customerPrice: string;
  effectiveCustomerPrice?: string;
};

type SizeProductLike = { id: string; options: SizeOptionLike[] };

export type SizeBracketProblem = { category: SizeBracketCategory; reason: "missing" | "multiple" };

export function isSizeBracketCategory(category: string | null | undefined): category is SizeBracketCategory {
  return category === SIZE_VOLUME_CATEGORY || category === SIZE_WEIGHT_CATEGORY;
}

function priceOf(option: SizeOptionLike): number {
  const parsed = Number((option.effectiveCustomerPrice ?? option.customerPrice ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function splitSizeBracketOptionIds(product: SizeProductLike, ids: string[]) {
  const sizeIds: string[] = [];
  const otherIds: string[] = [];

  for (const id of ids) {
    const option = (product.options ?? []).find((o) => o.id === id);
    (option && isSizeBracketCategory(option.category) ? sizeIds : otherIds).push(id);
  }

  return { sizeIds, otherIds };
}

// Which selected bracket carries the charge. Highest effective customer price
// wins; on a tie the volume bracket does, so the result never depends on the
// order the ids happen to be stored in.
export function resolveSizeBracketCharge(product: SizeProductLike, selectedIds: string[]) {
  const { sizeIds } = splitSizeBracketOptionIds(product, selectedIds);
  const selected = sizeIds
    .map((id) => (product.options ?? []).find((o) => o.id === id))
    .filter((o): o is SizeOptionLike => !!o)
    .sort((a, b) => {
      const byPrice = priceOf(b) - priceOf(a);
      if (byPrice !== 0) return byPrice;
      // tie: volume before weight
      return (a.category === SIZE_VOLUME_CATEGORY ? 0 : 1) - (b.category === SIZE_VOLUME_CATEGORY ? 0 : 1);
    });

  const [chargeable, ...waived] = selected;
  return { chargeableId: chargeable?.id ?? null, waivedIds: waived.map((o) => o.id) };
}

// A product that offers brackets in a category needs exactly one of them
// chosen. Enforced server-side, otherwise a customer could skip the selectors
// and dodge the surcharge.
export function getSizeBracketProblems(product: SizeProductLike, selectedIds: string[]): SizeBracketProblem[] {
  const problems: SizeBracketProblem[] = [];

  for (const category of SIZE_BRACKET_CATEGORIES) {
    const offered = (product.options ?? []).filter((o) => o.active && o.category === category);
    if (offered.length === 0) continue;

    const chosen = offered.filter((o) => selectedIds.includes(o.id));
    if (chosen.length === 0) problems.push({ category, reason: "missing" });
    else if (chosen.length > 1) problems.push({ category, reason: "multiple" });
  }

  return problems;
}

export function findCardsWithSizeBracketProblems(
  cards: Array<{ cardId: number; productId: string | null; selectedExtraOptionIds: string[] }>,
  products: SizeProductLike[],
): number[] {
  return cards
    .filter((card) => {
      const product = card.productId ? products.find((p) => p.id === card.productId) : null;
      return !!product && getSizeBracketProblems(product, card.selectedExtraOptionIds).length > 0;
    })
    .map((card) => card.cardId);
}

// A size-priced product is a catch-all ("Other furniture"): the customer must
// also say WHAT it is, in a short free-text name kept in the card's
// modelNumber (already carried into order items, summaries and the dashboard,
// so it shows up as "Other furniture - Grandfather clock").
export const MAX_ITEM_NAME_LENGTH = 80;

export function isSizePricedProduct(product: SizeProductLike): boolean {
  return (product.options ?? []).some((o) => o.active && isSizeBracketCategory(o.category));
}

// Size-priced cards whose name is missing, blank, too long, or not even a
// string (a hand-crafted request). Character rules are checked separately by
// the route with the shared public-text validator.
export function findSizePricedCardsMissingName(
  cards: Array<{ cardId: number; productId: string | null; modelNumber: string }>,
  products: SizeProductLike[],
): number[] {
  return cards
    .filter((card) => {
      const product = card.productId ? products.find((p) => p.id === card.productId) : null;
      if (!product || !isSizePricedProduct(product)) return false;

      const name = typeof card.modelNumber === "string" ? card.modelNumber.trim() : "";
      return name.length === 0 || name.length > MAX_ITEM_NAME_LENGTH;
    })
    .map((card) => card.cardId);
}
