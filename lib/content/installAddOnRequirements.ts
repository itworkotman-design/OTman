import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { shortenCatalogCode } from "./shortCatalogCode";

// Stackable install add-ons that never go with particular install types. Not
// encoded in the seed data (no schema field for it): the product card hides
// the add-on then, and validateWebsiteOrderCards refuses an order that has it
// anyway.
//   - An integrated front panel makes no sense on a freestanding fridge/freezer.
// (The TV stand / feet used to be an add-on tied to table mounting 75"-100";
// it is now its own install type — see whiteGoodsElectronics.ts.)
const ADD_ON_EXCLUDED_TYPES: Record<string, readonly string[]> = {
  UPRIGHT_FREEZER_INT_FP: ["UPRIGHT_FREEZER_FS"],
  FRIDGE_FREEZER_INT_FP: ["FRIDGE_FREEZER_FS"],
};

function isRestrictedAddOn(code: string) {
  return !!ADD_ON_EXCLUDED_TYPES[shortenCatalogCode(code)];
}

export function isInstallAddOnAllowed(addOnCode: string, selectedTypeCode: string | undefined): boolean {
  const excluded = ADD_ON_EXCLUDED_TYPES[shortenCatalogCode(addOnCode)];
  if (!excluded || !selectedTypeCode) return true;
  return !excluded.includes(shortenCatalogCode(selectedTypeCode));
}

// Card ids holding a restricted add-on together with an install type it excludes.
export function findCardsWithDisallowedInstallAddOns(cards: SavedProductCard[], products: CatalogProduct[]): number[] {
  return cards
    .filter((card) => {
      const product = products.find((p) => p.id === card.productId);
      if (!product) return false;
      const selected = card.selectedInstallOptionIds
        .map((id) => product.options.find((o) => o.id === id)?.code)
        .filter((code): code is string => !!code);
      const typeCode = selected.find((code) => !isRestrictedAddOn(code));
      return selected.some((code) => !isInstallAddOnAllowed(code, typeCode));
    })
    .map((card) => card.cardId);
}
