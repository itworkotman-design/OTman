import type { CatalogOption, CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { shortenCatalogCode } from "./shortCatalogCode";

// Extras that only make sense together with another extra on the same card.
// Not encoded in the seed data (no schema field for it): the product card
// disables the extra until its requirement is ticked, and
// validateWebsiteOrderCards refuses an order that has it anyway.
//   - Taking the empty pallet only once we've taken the goods off it
//     (UNPACKING, worded "Take the goods off the pallet" on pallets).
const EXTRA_REQUIRES: Record<string, string> = {
  PALLET_PICKUP: "UNPACKING",
};

export function isExtraOptionAllowed(extraCode: string, selectedExtraCodes: string[]): boolean {
  const required = EXTRA_REQUIRES[shortenCatalogCode(extraCode)];
  if (!required) return true;
  return selectedExtraCodes.some((code) => shortenCatalogCode(code) === required);
}

function selectedCodes(selectedIds: string[], options: CatalogOption[]) {
  return selectedIds
    .map((id) => options.find((o) => o.id === id)?.code)
    .filter((code): code is string => !!code);
}

// The selected extra ids minus any whose requirement is no longer selected —
// unticking "take the goods off the pallet" also unticks taking the pallet.
export function dropExtrasMissingRequirement(selectedIds: string[], options: CatalogOption[]): string[] {
  const codes = selectedCodes(selectedIds, options);
  return selectedIds.filter((id) => {
    const code = options.find((o) => o.id === id)?.code;
    return !code || isExtraOptionAllowed(code, codes);
  });
}

// Card ids holding an extra without the extra it requires.
export function findCardsWithDisallowedExtraOptions(cards: SavedProductCard[], products: CatalogProduct[]): number[] {
  return cards
    .filter((card) => {
      const product = products.find((p) => p.id === card.productId);
      if (!product) return false;
      const codes = selectedCodes(card.selectedExtraOptionIds, product.options);
      return codes.some((code) => !isExtraOptionAllowed(code, codes));
    })
    .map((card) => card.cardId);
}
