import { describe, expect, it } from "vitest";
import {
  SIZE_VOLUME_CATEGORY,
  SIZE_WEIGHT_CATEGORY,
  MAX_ITEM_NAME_LENGTH,
  findCardsWithSizeBracketProblems,
  findSizePricedCardsMissingName,
  isSizePricedProduct,
  getSizeBracketProblems,
  isSizeBracketCategory,
  resolveSizeBracketCharge,
  splitSizeBracketOptionIds,
} from "./sizeBrackets";

function option(id: string, category: string | null, price: string, extra: Record<string, unknown> = {}) {
  return { id, category, customerPrice: price, effectiveCustomerPrice: price, active: true, ...extra };
}

const product = {
  id: "p1",
  options: [
    option("vol-small", SIZE_VOLUME_CATEGORY, "100"),
    option("vol-big", SIZE_VOLUME_CATEGORY, "400"),
    option("wt-light", SIZE_WEIGHT_CATEGORY, "150"),
    option("wt-heavy", SIZE_WEIGHT_CATEGORY, "300"),
    option("unpacking", "extra", "103"),
    option("wt-retired", SIZE_WEIGHT_CATEGORY, "999", { active: false }),
  ],
};

describe("isSizeBracketCategory", () => {
  it("recognises exactly the two size categories", () => {
    expect(isSizeBracketCategory(SIZE_VOLUME_CATEGORY)).toBe(true);
    expect(isSizeBracketCategory(SIZE_WEIGHT_CATEGORY)).toBe(true);
    expect(isSizeBracketCategory("extra")).toBe(false);
    expect(isSizeBracketCategory(null)).toBe(false);
  });
});

describe("splitSizeBracketOptionIds", () => {
  it("separates size-bracket option ids from ordinary extras, keeping order", () => {
    expect(splitSizeBracketOptionIds(product, ["unpacking", "vol-big", "wt-light"])).toEqual({
      sizeIds: ["vol-big", "wt-light"],
      otherIds: ["unpacking"],
    });
  });

  it("treats ids that aren't options of this product (e.g. order-level special options) as ordinary", () => {
    expect(splitSizeBracketOptionIds(product, ["special-1"])).toEqual({ sizeIds: [], otherIds: ["special-1"] });
  });
});

describe("resolveSizeBracketCharge", () => {
  it("charges the pricier of the volume and weight brackets (weight wins here)", () => {
    expect(resolveSizeBracketCharge(product, ["vol-small", "wt-heavy"])).toEqual({
      chargeableId: "wt-heavy",
      waivedIds: ["vol-small"],
    });
  });

  it("charges the volume bracket when it is the pricier one", () => {
    expect(resolveSizeBracketCharge(product, ["vol-big", "wt-light"])).toEqual({
      chargeableId: "vol-big",
      waivedIds: ["wt-light"],
    });
  });

  it("on an exact tie charges the volume bracket, deterministically", () => {
    const tied = {
      id: "p",
      options: [option("v", SIZE_VOLUME_CATEGORY, "200"), option("w", SIZE_WEIGHT_CATEGORY, "200")],
    };

    expect(resolveSizeBracketCharge(tied, ["w", "v"])).toEqual({ chargeableId: "v", waivedIds: ["w"] });
  });

  it("compares the effective customer price, not the raw list price", () => {
    const discounted = {
      id: "p",
      options: [
        option("v", SIZE_VOLUME_CATEGORY, "500", { effectiveCustomerPrice: "100" }),
        option("w", SIZE_WEIGHT_CATEGORY, "200", { effectiveCustomerPrice: "200" }),
      ],
    };

    expect(resolveSizeBracketCharge(discounted, ["v", "w"]).chargeableId).toBe("w");
  });

  it("charges the only selected bracket when just one category was chosen", () => {
    expect(resolveSizeBracketCharge(product, ["vol-small"])).toEqual({ chargeableId: "vol-small", waivedIds: [] });
  });

  it("returns nothing to charge when no size bracket is selected", () => {
    expect(resolveSizeBracketCharge(product, ["unpacking"])).toEqual({ chargeableId: null, waivedIds: [] });
  });
});

describe("getSizeBracketProblems", () => {
  it("reports no problem when exactly one bracket per category is selected", () => {
    expect(getSizeBracketProblems(product, ["vol-small", "wt-light"])).toEqual([]);
  });

  it("reports the categories the customer skipped (so the surcharge can't be dodged by not choosing)", () => {
    expect(getSizeBracketProblems(product, [])).toEqual([
      { category: SIZE_VOLUME_CATEGORY, reason: "missing" },
      { category: SIZE_WEIGHT_CATEGORY, reason: "missing" },
    ]);
    expect(getSizeBracketProblems(product, ["vol-small"])).toEqual([{ category: SIZE_WEIGHT_CATEGORY, reason: "missing" }]);
  });

  it("reports more than one bracket picked in the same category", () => {
    expect(getSizeBracketProblems(product, ["vol-small", "vol-big", "wt-light"])).toEqual([
      { category: SIZE_VOLUME_CATEGORY, reason: "multiple" },
    ]);
  });

  it("ignores inactive options and products with no size brackets at all", () => {
    const noSizes = { id: "p2", options: [option("unpacking", "extra", "103")] };
    expect(getSizeBracketProblems(noSizes, [])).toEqual([]);

    const onlyRetiredWeight = {
      id: "p3",
      options: [option("v", SIZE_VOLUME_CATEGORY, "1"), option("w", SIZE_WEIGHT_CATEGORY, "1", { active: false })],
    };
    expect(getSizeBracketProblems(onlyRetiredWeight, ["v"])).toEqual([]);
  });
});

describe("findCardsWithSizeBracketProblems", () => {
  it("returns the ids of cards whose product needs brackets that weren't (validly) chosen", () => {
    const cards = [
      { cardId: 1, productId: "p1", selectedExtraOptionIds: ["vol-small", "wt-light"] },
      { cardId: 2, productId: "p1", selectedExtraOptionIds: ["vol-small"] },
      { cardId: 3, productId: "other", selectedExtraOptionIds: [] },
      { cardId: 4, productId: null, selectedExtraOptionIds: [] },
    ];
    const products = [product, { id: "other", options: [option("x", "extra", "1")] }];

    expect(findCardsWithSizeBracketProblems(cards, products)).toEqual([2]);
  });
});

describe("size-priced products need a name for the item", () => {
  it("isSizePricedProduct is true only for products with size brackets", () => {
    expect(isSizePricedProduct(product)).toBe(true);
    expect(isSizePricedProduct({ id: "x", options: [option("u", "extra", "1")] })).toBe(false);
    expect(isSizePricedProduct({ id: "x", options: [option("v", SIZE_VOLUME_CATEGORY, "1", { active: false })] })).toBe(false);
  });

  it("finds size-priced cards whose name is empty, blank or over the length limit", () => {
    const cards = [
      { cardId: 1, productId: "p1", modelNumber: "Grandfather clock" },
      { cardId: 2, productId: "p1", modelNumber: "" },
      { cardId: 3, productId: "p1", modelNumber: "   " },
      { cardId: 4, productId: "p1", modelNumber: "x".repeat(MAX_ITEM_NAME_LENGTH + 1) },
      { cardId: 5, productId: "p1", modelNumber: "x".repeat(MAX_ITEM_NAME_LENGTH) },
      { cardId: 6, productId: "other", modelNumber: "" },
      { cardId: 7, productId: null, modelNumber: "" },
    ];
    const products = [product, { id: "other", options: [option("u", "extra", "1")] }];

    expect(findSizePricedCardsMissingName(cards, products)).toEqual([2, 3, 4]);
  });

  it("treats a non-string name (a hand-crafted request) as missing", () => {
    const cards = [{ cardId: 1, productId: "p1", modelNumber: 42 as unknown as string }];

    expect(findSizePricedCardsMissingName(cards, [product])).toEqual([1]);
  });
});
