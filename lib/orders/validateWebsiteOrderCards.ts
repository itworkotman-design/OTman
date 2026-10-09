import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { findUnsellableProductIds } from "@/lib/content/mergeWebsiteCatalogs";
import {
  findCardsWithSizeBracketProblems,
  findSizePricedCardsMissingName,
  isSizePricedProduct,
} from "@/lib/booking/pricing/sizeBrackets";
import { applyDimensionDerivedVolumeBrackets } from "@/lib/booking/pricing/sizeDimensions";
import { findInstallOnlyCardsMissingInstall } from "@/lib/booking/installOnlyRequirement";
import { findCardsWithDisallowedInstallAddOns } from "@/lib/content/installAddOnRequirements";
import { validateTextField } from "./websiteOrderValidation";

// The product-card rules every customer-made homepage order is held to — at
// booking (app/api/site/white-goods-order) and when the customer changes it
// later in "My order" (app/api/customer/orders/[orderNumber]). Returns the
// cards as they should be stored: the volume bracket derived from the
// dimensions, size-priced item names trimmed.
export type WebsiteOrderCardsValidation =
  | { ok: true; cards: SavedProductCard[] }
  | { ok: false; reason: "UNKNOWN_PRODUCT" | "SIZE_BRACKETS_REQUIRED" | "INSTALL_OPTION_REQUIRED" | "INSTALL_ADDON_NOT_ALLOWED" | "ITEM_NAME_REQUIRED" };

// `previousCards` (a "My order" change): a card that keeps exactly the
// installation choices it already had is not re-checked against the add-on
// rule — orders booked before the rule existed must stay editable.
export function validateWebsiteOrderCards(
  submitted: SavedProductCard[],
  products: CatalogProduct[],
  { previousCards = [] }: { previousCards?: SavedProductCard[] } = {},
): WebsiteOrderCardsValidation {
  if (findUnsellableProductIds(submitted, products).length > 0) return { ok: false, reason: "UNKNOWN_PRODUCT" };

  // Products priced by size (Other furniture): the volume bracket is DERIVED
  // here from the customer's width/height/length — a bracket sent by the client
  // is never trusted (small bracket + big dimensions would dodge the charge).
  let cards = applyDimensionDerivedVolumeBrackets(submitted, products);

  // ...and each such card must end up with exactly one volume and one weight
  // bracket, otherwise the surcharge could be dodged by simply not choosing.
  if (findCardsWithSizeBracketProblems(cards, products).length > 0) return { ok: false, reason: "SIZE_BRACKETS_REQUIRED" };

  // An installation-only item with no installation picked is an order for
  // nothing (the client auto-selects one — this is the backstop).
  if (findInstallOnlyCardsMissingInstall(cards, products).length > 0) return { ok: false, reason: "INSTALL_OPTION_REQUIRED" };

  // An install add-on tied to one install type (TV stand / feet only with
  // table mounting) — the card hides it otherwise; this is the backstop.
  const installKey = (card: SavedProductCard) => [...card.selectedInstallOptionIds].sort().join(",");
  const unchangedInstall = (card: SavedProductCard) =>
    previousCards.some((prev) => prev.cardId === card.cardId && prev.productId === card.productId && installKey(prev) === installKey(card));
  const addOnProblems = findCardsWithDisallowedInstallAddOns(cards, products).filter(
    (cardId) => !unchangedInstall(cards.find((c) => c.cardId === cardId)!),
  );
  if (addOnProblems.length > 0) return { ok: false, reason: "INSTALL_ADDON_NOT_ALLOWED" };

  // ...and say what the item is: a short name in the same plain-text rules as
  // every other public free-text field. Stored trimmed.
  if (findSizePricedCardsMissingName(cards, products).length > 0) return { ok: false, reason: "ITEM_NAME_REQUIRED" };
  const sizePriced = (card: SavedProductCard) => {
    const product = products.find((p) => p.id === card.productId);
    return !!product && isSizePricedProduct(product);
  };
  if (cards.some((card) => sizePriced(card) && validateTextField(card.modelNumber))) return { ok: false, reason: "ITEM_NAME_REQUIRED" };
  cards = cards.map((card) => (sizePriced(card) ? { ...card, modelNumber: card.modelNumber.trim() } : card));

  return { ok: true, cards };
}
