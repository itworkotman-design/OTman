import type {
  CatalogProduct,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES } from "@/lib/booking/constants";

// "Installation only" without an installation picked is an order for nothing.
// The website card auto-selects one (pickDefaultInstallOptionId) and won't let
// it be cleared; this is the check behind that, shared by the booking flow's
// step readiness and the order route.
export function findInstallOnlyCardsMissingInstall(
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
): number[] {
  return cards
    .filter((card) => {
      if (card.deliveryType !== DELIVERY_TYPES.INSTALL_ONLY) return false;
      const product = catalogProducts.find((p) => p.id === card.productId);
      const optionIds = new Set((product?.options ?? []).filter((o) => o.active).map((o) => o.id));
      return !card.selectedInstallOptionIds.some((id) => optionIds.has(id));
    })
    .map((card) => card.cardId);
}
