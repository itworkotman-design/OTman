import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { MAX_ITEM_NAME_LENGTH, isSizeBracketCategory, splitSizeBracketOptionIds } from "@/lib/booking/pricing/sizeBrackets";
import { applyDimensionDerivedVolumeBrackets, isAllowedDimensionCm, type SizeDimensionsCm } from "@/lib/booking/pricing/sizeDimensions";

// Size-priced products (Other furniture) get their volume and weight chosen
// right in the "Choose products" tile — see WhiteGoodsProductGrid. The choice
// is stored on the product's card like any other option
// (selectedExtraOptionIds, recognised by option category — see
// lib/booking/pricing/sizeBrackets.ts).

// Picks `optionId` as the bracket for its category on this product's card,
// replacing whichever bracket of the same category was chosen before and
// leaving everything else on the card alone. Returns the same array when there
// is nothing to change.
export function applySizeBracketSelection(
  cards: SavedProductCard[],
  product: CatalogProduct,
  optionId: string,
): SavedProductCard[] {
  const option = product.options.find((o) => o.id === optionId);
  if (!option || !isSizeBracketCategory(option.category)) return cards;

  const sameCategoryIds = product.options.filter((o) => o.category === option.category).map((o) => o.id);
  const index = cards.findIndex((card) => card.productId === product.id);
  if (index === -1) return cards;

  return cards.map((card, i) =>
    i === index
      ? {
          ...card,
          selectedExtraOptionIds: [...card.selectedExtraOptionIds.filter((id) => !sameCategoryIds.includes(id)), optionId],
        }
      : card,
  );
}

// Sets one of the item's width / height / length (from the preset choices) on
// this product's card and re-derives its volume bracket from the dimensions —
// the volume is calculated, the customer never picks a volume bracket. Until
// all three are chosen (or when the item is too big for any bracket) the card
// has no volume bracket, which keeps the "Choose products" step open.
export function applySizeDimension(
  cards: SavedProductCard[],
  product: CatalogProduct,
  axis: keyof SizeDimensionsCm,
  valueCm: number,
): SavedProductCard[] {
  if (!isAllowedDimensionCm(valueCm)) return cards;

  const index = cards.findIndex((card) => card.productId === product.id);
  if (index === -1) return cards;

  const updated: SavedProductCard = {
    ...cards[index],
    sizeDimensionsCm: { ...cards[index].sizeDimensionsCm, [axis]: valueCm },
  };
  const [derived] = applyDimensionDerivedVolumeBrackets([updated], [product]);

  return cards.map((card, i) => (i === index ? derived : card));
}

// "What is it?" — the short free-text name of a size-priced item. Kept in the
// card's modelNumber (already carried through pricing, order items and the
// dashboard) and stored as typed (trimmed on the server), capped at the maximum
// length.
export function applyItemName(cards: SavedProductCard[], product: CatalogProduct, name: string): SavedProductCard[] {
  const index = cards.findIndex((card) => card.productId === product.id);
  if (index === -1) return cards;

  return cards.map((card, i) => (i === index ? { ...card, modelNumber: name.slice(0, MAX_ITEM_NAME_LENGTH) } : card));
}

// The dimensions chosen so far on this product's card (possibly partial).
export function getSizeDimensions(cards: SavedProductCard[], product: CatalogProduct): Partial<SizeDimensionsCm> | null {
  return cards.find((c) => c.productId === product.id)?.sizeDimensionsCm ?? null;
}

// The size-bracket ids currently chosen on this product's card.
export function getSelectedSizeOptionIds(cards: SavedProductCard[], product: CatalogProduct): string[] {
  const card = cards.find((c) => c.productId === product.id);
  return card ? splitSizeBracketOptionIds(product, card.selectedExtraOptionIds).sizeIds : [];
}
