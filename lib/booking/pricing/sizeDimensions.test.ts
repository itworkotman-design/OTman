import { describe, expect, it } from "vitest";
import { createEmptyProductCard, type CatalogProduct, type SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import {
  SIZE_DIMENSION_MAX_CM,
  SIZE_DIMENSION_MIN_CM,
  SIZE_DIMENSION_SCALE_MARKS_CM,
  SIZE_DIMENSION_STEP_CM,
  VOLUME_BRACKET_MAX_M3,
  applyDimensionDerivedVolumeBrackets,
  calculateVolumeM3,
  findVolumeBracketOptionId,
  getVolumeBracketLimitsM3,
  isAllowedDimensionCm,
  isCompleteDimensions,
  parseTypedDimensionCm,
} from "./sizeDimensions";

function option(id: string, code: string, category: string, active = true) {
  return { id, code, category, active, customerPrice: "0" };
}

const product = {
  id: "p1",
  options: [
    option("v1", "OF_VOL_SM", "size_volume"), // up to 1.5 (small)
    option("v2", "OF_VOL_LG", "size_volume"), // up to 4 (large)
    option("w1", "OF_WT_SM", "size_weight"),
    option("w2", "OF_WT_LG", "size_weight"),
    option("unpacking", "UNPACKING", "extra"),
  ],
} as unknown as CatalogProduct;

const dims = (widthCm: number, heightCm: number, lengthCm: number) => ({ widthCm, heightCm, lengthCm });

function card(productId: string, selectedExtraOptionIds: string[], sizeDimensionsCm?: SavedProductCard["sizeDimensionsCm"]) {
  return { ...createEmptyProductCard(0), productId, selectedExtraOptionIds, sizeDimensionsCm } as SavedProductCard;
}

describe("dimension range", () => {
  it("allows centimetres in 5 cm steps from 5 to 300", () => {
    expect([SIZE_DIMENSION_MIN_CM, SIZE_DIMENSION_MAX_CM, SIZE_DIMENSION_STEP_CM]).toEqual([5, 300, 5]);
    for (const cm of [5, 10, 135, 300]) expect(isAllowedDimensionCm(cm), String(cm)).toBe(true);
  });

  it("rejects anything outside that, between steps, a fraction, or not a number", () => {
    for (const bad of [0, 1, 7, 137, 305, -50, 12.5, NaN, Infinity, "50", null]) {
      expect(isAllowedDimensionCm(bad), String(bad)).toBe(false);
    }
  });

  it("puts faint scale marks along the ruler, inside the range, ascending", () => {
    const marks = [...SIZE_DIMENSION_SCALE_MARKS_CM];
    expect(marks.length).toBeGreaterThan(3);
    expect(marks).toEqual([...marks].sort((a, b) => a - b));
    expect(marks.every((cm) => isAllowedDimensionCm(cm))).toBe(true);
  });

  it("isCompleteDimensions needs all three allowed values", () => {
    expect(isCompleteDimensions(dims(100, 50, 50))).toBe(true);
    expect(isCompleteDimensions({ widthCm: 100, heightCm: 50 })).toBe(false);
    expect(isCompleteDimensions(dims(100, 50, 0))).toBe(false);
    expect(isCompleteDimensions(null)).toBe(false);
    expect(isCompleteDimensions(undefined)).toBe(false);
  });
});

describe("parseTypedDimensionCm", () => {
  it("reads what the customer typed into the box, rounded to the nearest 5 cm", () => {
    expect(parseTypedDimensionCm("120")).toBe(120);
    expect(parseTypedDimensionCm(" 85 cm ")).toBe(85);
    expect(parseTypedDimensionCm("122")).toBe(120);
    expect(parseTypedDimensionCm("123")).toBe(125);
    expect(parseTypedDimensionCm("12,6")).toBe(15);
    expect(parseTypedDimensionCm("12.4")).toBe(10);
  });

  it("clamps to the ruler's range", () => {
    expect(parseTypedDimensionCm("450")).toBe(300);
    expect(parseTypedDimensionCm("0")).toBe(5);
    expect(parseTypedDimensionCm("2")).toBe(5);
  });

  it("is null for nothing typed or no number", () => {
    expect(parseTypedDimensionCm("")).toBeNull();
    expect(parseTypedDimensionCm("   ")).toBeNull();
    expect(parseTypedDimensionCm("abc")).toBeNull();
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
  it("has a maximum m³ for the small and the large volume bracket, ascending", () => {
    const maxes = ["OF_VOL_SM", "OF_VOL_LG"].map((code) => VOLUME_BRACKET_MAX_M3[code]);
    expect(maxes.every((m) => typeof m === "number" && m > 0)).toBe(true);
    expect(maxes).toEqual([...maxes].sort((a, b) => a - b));
  });
});

describe("getVolumeBracketLimitsM3", () => {
  it("lists the product's volume bracket limits, smallest first — the last is the most bookable online", () => {
    expect(getVolumeBracketLimitsM3(product)).toEqual([1.5, 4]);
  });

  it("skips inactive brackets, and is empty for a product without any", () => {
    const retired = { id: "p", options: [option("v1", "OF_VOL_SM", "size_volume", false), option("v2", "OF_VOL_LG", "size_volume")] } as unknown as CatalogProduct;
    expect(getVolumeBracketLimitsM3(retired)).toEqual([4]);
    expect(getVolumeBracketLimitsM3({ id: "x", options: [] } as unknown as CatalogProduct)).toEqual([]);
  });
});

describe("findVolumeBracketOptionId", () => {
  it("picks the smallest bracket the volume fits in (a volume equal to the limit fits that bracket)", () => {
    expect(findVolumeBracketOptionId(product, 0.05)).toBe("v1");
    expect(findVolumeBracketOptionId(product, 1.5)).toBe("v1");
    expect(findVolumeBracketOptionId(product, 1.51)).toBe("v2");
    expect(findVolumeBracketOptionId(product, 4)).toBe("v2");
  });

  it("returns null for a volume larger than the top bracket (not bookable online)", () => {
    expect(findVolumeBracketOptionId(product, 4.01)).toBeNull();
  });

  it("ignores inactive brackets", () => {
    const retired = {
      id: "p",
      options: [option("v1", "OF_VOL_SM", "size_volume", false), option("v2", "OF_VOL_LG", "size_volume")],
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
    const [next] = applyDimensionDerivedVolumeBrackets([card("p1", ["v1", "w1"], dims(200, 100, 100))], [product]);

    expect(next.selectedExtraOptionIds.sort()).toEqual(["v2", "w1"]);
  });

  it("removes the volume bracket when dimensions are missing, incomplete or out of range", () => {
    for (const bad of [undefined, null, { widthCm: 100, heightCm: 50 }, dims(100, 50, 0)]) {
      const [next] = applyDimensionDerivedVolumeBrackets(
        [card("p1", ["v1", "w1"], bad as SavedProductCard["sizeDimensionsCm"])],
        [product],
      );
      expect(next.selectedExtraOptionIds).toEqual(["w1"]);
    }
  });

  it("removes the volume bracket when the item is larger than the top bracket", () => {
    const [next] = applyDimensionDerivedVolumeBrackets([card("p1", ["w1"], dims(300, 300, 300))], [product]);

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
