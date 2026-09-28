import { describe, expect, it } from "vitest";
import { createEmptyProductCard, type CatalogProduct, type SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import {
  SIZE_DIMENSION_CHOICES_CM,
  VOLUME_BRACKET_MAX_M3,
  applyDimensionDerivedVolumeBrackets,
  calculateVolumeM3,
  findVolumeBracketOptionId,
  isAllowedDimensionCm,
  isCompleteDimensions,
} from "./sizeDimensions";

function option(id: string, code: string, category: string, active = true) {
  return { id, code, category, active, customerPrice: "0" };
}

const product = {
  id: "p1",
  options: [
    option("v1", "OF_VOL_1", "size_volume"), // up to 0.25
    option("v2", "OF_VOL_2", "size_volume"), // 0.5
    option("v3", "OF_VOL_3", "size_volume"), // 1
    option("v4", "OF_VOL_4", "size_volume"), // 2
    option("v5", "OF_VOL_5", "size_volume"), // 4
    option("w1", "OF_WT_1", "size_weight"),
    option("w2", "OF_WT_2", "size_weight"),
    option("unpacking", "UNPACKING", "extra"),
  ],
} as unknown as CatalogProduct;

const dims = (widthCm: number, heightCm: number, lengthCm: number) => ({ widthCm, heightCm, lengthCm });

function card(productId: string, selectedExtraOptionIds: string[], sizeDimensionsCm?: SavedProductCard["sizeDimensionsCm"]) {
  return { ...createEmptyProductCard(0), productId, selectedExtraOptionIds, sizeDimensionsCm } as SavedProductCard;
}

describe("dimension choices", () => {
  it("offers a fixed list of centimetre choices, ascending", () => {
    const values = [...SIZE_DIMENSION_CHOICES_CM];
    expect(values.length).toBeGreaterThan(3);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it("only allows values from that list", () => {
    expect(isAllowedDimensionCm(SIZE_DIMENSION_CHOICES_CM[0])).toBe(true);
    expect(isAllowedDimensionCm(7)).toBe(false);
    expect(isAllowedDimensionCm(-50)).toBe(false);
    expect(isAllowedDimensionCm("50")).toBe(false);
    expect(isAllowedDimensionCm(NaN)).toBe(false);
  });

  it("isCompleteDimensions needs all three allowed values", () => {
    expect(isCompleteDimensions(dims(100, 50, 50))).toBe(true);
    expect(isCompleteDimensions({ widthCm: 100, heightCm: 50 })).toBe(false);
    expect(isCompleteDimensions(dims(100, 50, 7))).toBe(false);
    expect(isCompleteDimensions(null)).toBe(false);
    expect(isCompleteDimensions(undefined)).toBe(false);
  });
});

describe("calculateVolumeM3", () => {
  it("multiplies width x height x length in cm and converts to m³", () => {
    expect(calculateVolumeM3(dims(100, 50, 50))).toBe(0.25);
    expect(calculateVolumeM3(dims(100, 100, 100))).toBe(1);
    expect(calculateVolumeM3(dims(200, 100, 100))).toBe(2);
  });
});

describe("volume bracket limits", () => {
  it("has a maximum m³ for each of the five volume brackets, ascending", () => {
    const maxes = ["OF_VOL_1", "OF_VOL_2", "OF_VOL_3", "OF_VOL_4", "OF_VOL_5"].map((code) => VOLUME_BRACKET_MAX_M3[code]);
    expect(maxes.every((m) => typeof m === "number" && m > 0)).toBe(true);
    expect(maxes).toEqual([...maxes].sort((a, b) => a - b));
  });
});

describe("findVolumeBracketOptionId", () => {
  it("picks the smallest bracket the volume fits in (a volume equal to the limit fits that bracket)", () => {
    expect(findVolumeBracketOptionId(product, 0.05)).toBe("v1");
    expect(findVolumeBracketOptionId(product, 0.25)).toBe("v1");
    expect(findVolumeBracketOptionId(product, 0.26)).toBe("v2");
    expect(findVolumeBracketOptionId(product, 1)).toBe("v3");
    expect(findVolumeBracketOptionId(product, 4)).toBe("v5");
  });

  it("returns null for a volume larger than the top bracket (not bookable online)", () => {
    expect(findVolumeBracketOptionId(product, 4.01)).toBeNull();
  });

  it("ignores inactive brackets", () => {
    const retired = {
      id: "p",
      options: [option("v1", "OF_VOL_1", "size_volume", false), option("v2", "OF_VOL_2", "size_volume")],
    } as unknown as CatalogProduct;

    expect(findVolumeBracketOptionId(retired, 0.1)).toBe("v2");
  });
});

describe("applyDimensionDerivedVolumeBrackets", () => {
  it("derives the volume bracket from the dimensions", () => {
    const [next] = applyDimensionDerivedVolumeBrackets([card("p1", ["w1"], dims(100, 50, 50))], [product]);

    expect(next.selectedExtraOptionIds.sort()).toEqual(["v1", "w1"]);
  });

  it("overrides a volume bracket the client claimed — the server never trusts it (a small bracket with big dimensions is a way to dodge the charge)", () => {
    const [next] = applyDimensionDerivedVolumeBrackets([card("p1", ["v1", "w1"], dims(100, 100, 100))], [product]);

    expect(next.selectedExtraOptionIds.sort()).toEqual(["v3", "w1"]);
  });

  it("removes the volume bracket when dimensions are missing, incomplete or not one of the allowed choices", () => {
    for (const bad of [undefined, null, { widthCm: 100, heightCm: 50 }, dims(100, 50, 7)]) {
      const [next] = applyDimensionDerivedVolumeBrackets(
        [card("p1", ["v1", "w1"], bad as SavedProductCard["sizeDimensionsCm"])],
        [product],
      );
      expect(next.selectedExtraOptionIds).toEqual(["w1"]);
    }
  });

  it("removes the volume bracket when the item is larger than the top bracket", () => {
    const [next] = applyDimensionDerivedVolumeBrackets([card("p1", ["w1"], dims(250, 250, 250))], [product]);

    expect(next.selectedExtraOptionIds).toEqual(["w1"]);
  });

  it("leaves the weight bracket and ordinary extras alone", () => {
    const [next] = applyDimensionDerivedVolumeBrackets([card("p1", ["unpacking", "w2"], dims(100, 50, 50))], [product]);

    expect(next.selectedExtraOptionIds.sort()).toEqual(["unpacking", "v1", "w2"]);
  });

  it("does not touch cards of products without volume brackets", () => {
    const plain = { id: "p2", options: [option("x", "UNPACKING", "extra")] } as unknown as CatalogProduct;
    const original = card("p2", ["x"]);

    const [next] = applyDimensionDerivedVolumeBrackets([original], [plain]);

    expect(next).toBe(original);
  });

  it("does not mutate its input", () => {
    const original = card("p1", ["v1"], dims(100, 100, 100));

    applyDimensionDerivedVolumeBrackets([original], [product]);

    expect(original.selectedExtraOptionIds).toEqual(["v1"]);
  });
});
