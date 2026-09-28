import { describe, expect, it } from "vitest";
import { createEmptyProductCard, type CatalogProduct, type SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { applyItemName, applySizeBracketSelection, applySizeDimension, getSelectedSizeOptionIds, getSizeDimensions } from "./sizeBracketSelection";

const product = {
  id: "p1",
  options: [
    { id: "vol-1", category: "size_volume", active: true, customerPrice: "0" },
    { id: "vol-2", category: "size_volume", active: true, customerPrice: "0" },
    { id: "wt-1", category: "size_weight", active: true, customerPrice: "0" },
    { id: "wt-2", category: "size_weight", active: true, customerPrice: "0" },
    { id: "unpacking", category: "extra", active: true, customerPrice: "0" },
  ],
} as unknown as CatalogProduct;

const card = (
  productId: string | null,
  selectedExtraOptionIds: string[] = [],
  sizeDimensionsCm?: SavedProductCard["sizeDimensionsCm"],
) =>
  ({ ...createEmptyProductCard(productId === "p1" ? 0 : 1), productId, selectedExtraOptionIds, sizeDimensionsCm }) as SavedProductCard;

describe("applySizeBracketSelection", () => {
  it("selects a bracket on the product's card", () => {
    const [next] = applySizeBracketSelection([card("p1")], product, "vol-2");

    expect(next.selectedExtraOptionIds).toEqual(["vol-2"]);
  });

  it("replaces the bracket already chosen in the same category, keeping the other category", () => {
    const [next] = applySizeBracketSelection([card("p1", ["vol-1", "wt-2"])], product, "vol-2");

    expect(next.selectedExtraOptionIds.sort()).toEqual(["vol-2", "wt-2"]);
  });

  it("leaves unrelated extras alone", () => {
    const [next] = applySizeBracketSelection([card("p1", ["unpacking"])], product, "wt-1");

    expect(next.selectedExtraOptionIds.sort()).toEqual(["unpacking", "wt-1"]);
  });

  it("only touches the card of that product", () => {
    const other = card("p2", ["x"]);
    const [, untouched] = applySizeBracketSelection([card("p1"), other], product, "vol-1");

    expect(untouched).toBe(other);
  });

  it("ignores an id that isn't a size bracket of the product", () => {
    const cards = [card("p1", ["vol-1"])];

    expect(applySizeBracketSelection(cards, product, "unpacking")).toBe(cards);
    expect(applySizeBracketSelection(cards, product, "nope")).toBe(cards);
  });

  it("does nothing when the product has no card yet", () => {
    const cards = [card("p2")];

    expect(applySizeBracketSelection(cards, product, "vol-1")).toBe(cards);
  });
});

describe("getSelectedSizeOptionIds", () => {
  it("returns just the size-bracket ids chosen on a product's card", () => {
    expect(getSelectedSizeOptionIds([card("p1", ["unpacking", "vol-1", "wt-2"])], product)).toEqual(["vol-1", "wt-2"]);
  });

  it("returns an empty list when the product has no card", () => {
    expect(getSelectedSizeOptionIds([card("p2")], product)).toEqual([]);
  });
});

describe("applySizeDimension", () => {
  const sized = {
    id: "p1",
    options: [
      { id: "v1", code: "OF_VOL_1", category: "size_volume", active: true, customerPrice: "0" },
      { id: "v3", code: "OF_VOL_3", category: "size_volume", active: true, customerPrice: "0" },
      { id: "w1", code: "OF_WT_1", category: "size_weight", active: true, customerPrice: "0" },
    ],
  } as unknown as CatalogProduct;

  it("stores a chosen dimension without a volume bracket until all three are chosen", () => {
    let cards = [card("p1")];
    cards = applySizeDimension(cards, sized, "widthCm", 100);
    cards = applySizeDimension(cards, sized, "heightCm", 50);

    expect(cards[0].sizeDimensionsCm).toEqual({ widthCm: 100, heightCm: 50 });
    expect(cards[0].selectedExtraOptionIds).toEqual([]);
  });

  it("derives the volume bracket once width, height and length are all chosen", () => {
    let cards = [card("p1")];
    cards = applySizeDimension(cards, sized, "widthCm", 100);
    cards = applySizeDimension(cards, sized, "heightCm", 50);
    cards = applySizeDimension(cards, sized, "lengthCm", 50);

    expect(cards[0].selectedExtraOptionIds).toEqual(["v1"]);
  });

  it("re-derives when a dimension changes, keeping the chosen weight", () => {
    let cards = [card("p1", ["w1"], { widthCm: 100, heightCm: 50, lengthCm: 50 })];
    cards = applySizeDimension(cards, sized, "lengthCm", 100);

    expect(cards[0].sizeDimensionsCm).toEqual({ widthCm: 100, heightCm: 50, lengthCm: 100 });
    // 100 x 50 x 100 = 0.5 m³ — above OF_VOL_1 (0.25), so the next bracket up (OF_VOL_3, up to 1 m³).
    expect(cards[0].selectedExtraOptionIds.sort()).toEqual(["v3", "w1"]);
  });

  it("drops the volume bracket when the item is too big for any bracket", () => {
    let cards = [card("p1", ["v1"], { widthCm: 100, heightCm: 50, lengthCm: 50 })];
    cards = applySizeDimension(cards, sized, "widthCm", 250);
    cards = applySizeDimension(cards, sized, "heightCm", 250);
    cards = applySizeDimension(cards, sized, "lengthCm", 250);

    expect(cards[0].selectedExtraOptionIds).toEqual([]);
  });

  it("ignores a value that isn't one of the preset choices, and cards it doesn't belong to", () => {
    const cards = [card("p1")];
    expect(applySizeDimension(cards, sized, "widthCm", 7)).toBe(cards);

    const other = [card("p2")];
    expect(applySizeDimension(other, sized, "widthCm", 100)).toBe(other);
  });
});

describe("getSizeDimensions", () => {
  it("returns a product's chosen dimensions, or null", () => {
    expect(getSizeDimensions([card("p1", [], { widthCm: 100 })], product)).toEqual({ widthCm: 100 });
    expect(getSizeDimensions([card("p1")], product)).toBeNull();
    expect(getSizeDimensions([card("p2")], product)).toBeNull();
  });
});

describe("applyItemName", () => {
  it("stores what the item is on the product's card, as typed", () => {
    const [next] = applyItemName([card("p1")], product, "Grandfather clock ");

    expect(next.modelNumber).toBe("Grandfather clock ");
  });

  it("caps the name at the maximum length", () => {
    const [next] = applyItemName([card("p1")], product, "x".repeat(200));

    expect(next.modelNumber).toHaveLength(80);
  });

  it("only touches the card of that product, and does nothing without a card", () => {
    const other = card("p2");
    const [, untouched] = applyItemName([card("p1"), other], product, "Piano");
    expect(untouched).toBe(other);

    const cards = [card("p2")];
    expect(applyItemName(cards, product, "Piano")).toBe(cards);
  });
});
