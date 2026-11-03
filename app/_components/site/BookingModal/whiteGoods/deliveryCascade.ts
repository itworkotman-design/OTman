import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { isSizeBracketCategory } from "@/lib/booking/pricing/sizeBrackets";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { getProductDeliveryType } from "@/lib/products/deliveryTypes";
import { buildOptionSeedMap, groupAssemblyOptions, pickDefaultInstallOptionId } from "./optionGroups";
import { cardsForList } from "./websiteLists";

// A card switched to another delivery type, exactly as picking it on the card
// does (WhiteGoodsProductCard): the add-ons are cleared — except the item's
// size and weight (Other furniture), which describe the item itself — and
// installation only starts with the product's first installation, so it can
// never be left with nothing to install.
export function cardWithDeliveryType(
  card: SavedProductCard,
  product: CatalogProduct,
  next: SavedProductCard["deliveryType"],
  locale: Locale,
): SavedProductCard {
  const seedByCode = buildOptionSeedMap(product.code);
  const typeOptions = product.options.filter((o) => o.active && seedByCode.get(o.code)?.exclusiveGroup === "type");
  const defaultInstallOptionId = pickDefaultInstallOptionId({
    assemblyGroups: groupAssemblyOptions(product.options, seedByCode, locale),
    typeOptions,
  });
  const sizeOptionIds = product.options.filter((o) => isSizeBracketCategory(o.category)).map((o) => o.id);

  return {
    ...card,
    deliveryType: next,
    selectedInstallOptionIds: next === "INSTALL_ONLY" && defaultInstallOptionId ? [defaultInstallOptionId] : [],
    selectedExtraOptionIds: card.selectedExtraOptionIds.filter((id) => sizeOptionIds.includes(id)),
    selectedReturnOptionId: null,
    demontEnabled: false,
  };
}

// A new order with several products in one price list: when the customer
// changes the delivery type on that list's FIRST card, the list's other cards
// get it too — so "carry everything in" is one click. Only while none of
// those other cards has been edited (`editedCardIds`: a choice made there is
// kept), and a product that doesn't offer the type keeps its own. The caller
// runs it once per list and never for an existing order. Returns the new
// cards, or null when it doesn't apply.
export function cascadeFirstCardDelivery({
  cards,
  changedCardId,
  listProducts,
  editedCardIds,
  locale,
}: {
  // With the first card's change already applied.
  cards: SavedProductCard[];
  changedCardId: number;
  listProducts: CatalogProduct[];
  editedCardIds: number[];
  locale: Locale;
}): SavedProductCard[] | null {
  const [first, ...rest] = cardsForList(cards, listProducts);
  if (!first || first.cardId !== changedCardId || rest.length === 0) return null;
  if (rest.some((card) => editedCardIds.includes(card.cardId))) return null;

  const next = first.deliveryType;
  const restIds = new Set(rest.map((card) => card.cardId));
  return cards.map((card) => {
    if (!restIds.has(card.cardId) || card.deliveryType === next) return card;
    const product = listProducts.find((p) => p.id === card.productId);
    if (!product || !getProductDeliveryType(product.deliveryTypes, next)?.enabled) return card;
    return cardWithDeliveryType(card, product, next, locale);
  });
}
