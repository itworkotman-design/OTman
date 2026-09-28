import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { SIZE_VOLUME_CATEGORY } from "@/lib/booking/pricing/sizeBrackets";

// Size-priced products (website furniture "Other furniture"): the customer
// picks width, height and length from preset choices, the volume (m³) is
// calculated from them, and that volume selects one of the volume brackets
// (lib/booking/pricing/sizeBrackets.ts) — so the pricing engines only ever see
// a bracket id, exactly as before. The customer picks the weight bracket
// separately.
//
// The bracket limits live HERE, in code (a m³ can't be mapped to a bracket
// from a price row alone). Staff edit bracket PRICES in editPrices; changing
// where a bracket ends is a code change (and its label in
// otherFurnitureSizeOptions.ts is generated from this same table).

export type SizeDimensionsCm = { widthCm: number; heightCm: number; lengthCm: number };

// The preset choices for each of width, height and length (cm). Placeholders —
// business content nobody has supplied yet; a value outside this list is
// rejected server-side, so this is the whole range a customer can price.
export const SIZE_DIMENSION_CHOICES_CM = [20, 40, 50, 60, 80, 100, 120, 150, 200, 250] as const;

// Largest volume (m³) each volume bracket covers, keyed by option code.
// Anything bigger than the top bracket isn't bookable online (a manual quote).
export const VOLUME_BRACKET_MAX_M3: Record<string, number> = {
  OF_VOL_1: 0.25,
  OF_VOL_2: 0.5,
  OF_VOL_3: 1,
  OF_VOL_4: 2,
  OF_VOL_5: 4,
};

export function isAllowedDimensionCm(value: unknown): value is number {
  return typeof value === "number" && (SIZE_DIMENSION_CHOICES_CM as readonly number[]).includes(value);
}

export function isCompleteDimensions(value: Partial<SizeDimensionsCm> | null | undefined): value is SizeDimensionsCm {
  return (
    !!value &&
    isAllowedDimensionCm(value.widthCm) &&
    isAllowedDimensionCm(value.heightCm) &&
    isAllowedDimensionCm(value.lengthCm)
  );
}

// cm x cm x cm -> m³ (1 m³ = 1,000,000 cm³). Integer cm inputs keep this exact
// for every preset combination.
export function calculateVolumeM3(dimensions: SizeDimensionsCm): number {
  return (dimensions.widthCm * dimensions.heightCm * dimensions.lengthCm) / 1_000_000;
}

type VolumeProductLike = Pick<CatalogProduct, "id" | "options">;

function volumeBrackets(product: VolumeProductLike) {
  return (product.options ?? [])
    .filter((o) => o.active && o.category === SIZE_VOLUME_CATEGORY && VOLUME_BRACKET_MAX_M3[o.code] !== undefined)
    .map((o) => ({ id: o.id, maxM3: VOLUME_BRACKET_MAX_M3[o.code] }))
    .sort((a, b) => a.maxM3 - b.maxM3);
}

// The smallest volume bracket the volume fits in (a volume equal to a limit
// fits that bracket); null when it is larger than the top one.
export function findVolumeBracketOptionId(product: VolumeProductLike, volumeM3: number): string | null {
  return volumeBrackets(product).find((bracket) => volumeM3 <= bracket.maxM3)?.id ?? null;
}

// Makes each size-priced card's volume bracket the one its dimensions imply.
// The client sends both, but the bracket is only ever DERIVED here — a claimed
// bracket that doesn't match (or dimensions that are missing, aren't one of the
// preset choices, or are too big) is dropped, never trusted, since a small
// bracket with big dimensions would dodge the charge. A card left without a
// volume bracket then fails the size-bracket check (see sizeBrackets.ts).
export function applyDimensionDerivedVolumeBrackets(
  cards: SavedProductCard[],
  products: VolumeProductLike[],
): SavedProductCard[] {
  return cards.map((card) => {
    const product = card.productId ? products.find((p) => p.id === card.productId) : null;
    if (!product) return card;

    const brackets = volumeBrackets(product);
    if (brackets.length === 0) return card;

    const volumeIds = new Set(brackets.map((b) => b.id));
    const withoutVolume = card.selectedExtraOptionIds.filter((id) => !volumeIds.has(id));
    const derivedId = isCompleteDimensions(card.sizeDimensionsCm)
      ? findVolumeBracketOptionId(product, calculateVolumeM3(card.sizeDimensionsCm))
      : null;

    return { ...card, selectedExtraOptionIds: derivedId ? [...withoutVolume, derivedId] : withoutVolume };
  });
}
