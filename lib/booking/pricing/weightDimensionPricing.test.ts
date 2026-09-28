import { describe, expect, it } from "vitest";
import {
  calculateWeightDimensionPriceCents,
  isWeightDimensionPricingMode,
  weightDimensionUnitLabel,
} from "./weightDimensionPricing";

describe("calculateWeightDimensionPriceCents", () => {
  it("charges base + rate × quantity", () => {
    // 5000 (50 kr base) + 3500 (35 kr/kg) × 2 kg = 5000 + 7000 = 12000 (120 kr)
    expect(calculateWeightDimensionPriceCents({ baseCents: 5000, ratePerUnitCents: 3500 }, 2)).toBe(12000);
  });

  it("rounds to the nearest whole cent", () => {
    // 0 base + 33333 × 1.5 = 49999.5 -> rounds to 50000
    expect(calculateWeightDimensionPriceCents({ baseCents: 0, ratePerUnitCents: 33333 }, 1.5)).toBe(50000);
  });

  it("works with a fractional quantity below 1 (e.g. 0.5 m³)", () => {
    expect(calculateWeightDimensionPriceCents({ baseCents: 1000, ratePerUnitCents: 2000 }, 0.5)).toBe(2000);
  });

  it("clamps to maxChargeCents when the computed price would exceed it", () => {
    // 5000 + 3500 × 100 = 355000, but capped at 100000.
    expect(
      calculateWeightDimensionPriceCents({ baseCents: 5000, ratePerUnitCents: 3500, maxChargeCents: 100000 }, 100),
    ).toBe(100000);
  });

  it("does not apply a cap below the computed price when none is set", () => {
    expect(calculateWeightDimensionPriceCents({ baseCents: 5000, ratePerUnitCents: 3500 }, 100)).toBe(355000);
  });

  it("ignores a non-positive maxChargeCents (treated as unset, never as a hard zero-out)", () => {
    expect(
      calculateWeightDimensionPriceCents({ baseCents: 5000, ratePerUnitCents: 3500, maxChargeCents: 0 }, 2),
    ).toBe(12000);
  });

  it("throws for a non-positive quantity — never a silent 0-charge or negative price", () => {
    expect(() => calculateWeightDimensionPriceCents({ baseCents: 5000, ratePerUnitCents: 3500 }, 0)).toThrow();
    expect(() => calculateWeightDimensionPriceCents({ baseCents: 5000, ratePerUnitCents: 3500 }, -1)).toThrow();
  });

  it("throws for a non-finite quantity", () => {
    expect(() => calculateWeightDimensionPriceCents({ baseCents: 5000, ratePerUnitCents: 3500 }, NaN)).toThrow();
    expect(() =>
      calculateWeightDimensionPriceCents({ baseCents: 5000, ratePerUnitCents: 3500 }, Infinity),
    ).toThrow();
  });
});

describe("isWeightDimensionPricingMode", () => {
  it("recognizes PER_KG and PER_M3", () => {
    expect(isWeightDimensionPricingMode("PER_KG")).toBe(true);
    expect(isWeightDimensionPricingMode("PER_M3")).toBe(true);
  });

  it("rejects FIXED, REQUEST, and anything else", () => {
    expect(isWeightDimensionPricingMode("FIXED")).toBe(false);
    expect(isWeightDimensionPricingMode("REQUEST")).toBe(false);
    expect(isWeightDimensionPricingMode("per_kg")).toBe(false);
    expect(isWeightDimensionPricingMode("")).toBe(false);
  });
});

describe("weightDimensionUnitLabel", () => {
  it("returns the right unit label per mode", () => {
    expect(weightDimensionUnitLabel("PER_KG")).toBe("kg");
    expect(weightDimensionUnitLabel("PER_M3")).toBe("m³");
  });
});
