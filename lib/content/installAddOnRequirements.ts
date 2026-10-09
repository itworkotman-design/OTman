import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { shortenCatalogCode } from "./shortCatalogCode";

// Stackable install add-ons that only make sense together with one particular
// install type. Not encoded in the seed data (no schema field for it): the
// product card hides the add-on otherwise, and validateWebsiteOrderCards
// refuses an order that has it anyway.
//   - TV stand / feet 75"-100" goes with table mounting — never wall mounting.
const ADD_ON_REQUIRED_TYPES: Record<string, readonly string[]> = {
  TV_MOUNT_STAND_75_100: ["TV_TABLE_75_100"],
};

export function isInstallAddOnAllowed(addOnCode: string, selectedTypeCode: string | undefined): boolean {
  const required = ADD_ON_REQUIRED_TYPES[shortenCatalogCode(addOnCode)];
  if (!required) return true;
  return !!selectedTypeCode && required.includes(shortenCatalogCode(selectedTypeCode));
}

// Card ids holding a restricted add-on without the install type it needs.
export function findCardsWithDisallowedInstallAddOns(cards: SavedProductCard[], products: CatalogProduct[]): number[] {
  return cards
    .filter((card) => {
      const product = products.find((p) => p.id === card.productId);
      if (!product) return false;
      const selected = card.selectedInstallOptionIds
        .map((id) => product.options.find((o) => o.id === id)?.code)
        .filter((code): code is string => !!code);
      const typeCode = selected.find((code) => !ADD_ON_REQUIRED_TYPES[shortenCatalogCode(code)]);
      return selected.some((code) => !isInstallAddOnAllowed(code, typeCode));
    })
    .map((card) => card.cardId);
}
