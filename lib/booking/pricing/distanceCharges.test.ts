import { describe, expect, it } from "vitest";

import {
  FULL_DISTANCE_KM_PRICING_FROM,
  getFullChargeableKilometers,
  getStartedChargeableKilometers,
  usesFullDistanceKmPricing,
} from "./distanceCharges";

describe("getStartedChargeableKilometers", () => {
  it("returns 0 at or below the included 20 km", () => {
    expect(getStartedChargeableKilometers(20)).toBe(0);
    expect(getStartedChargeableKilometers(19.99)).toBe(0);
  });

  it("charges the first started kilometer above 20 km", () => {
    expect(getStartedChargeableKilometers(20.01)).toBe(1);
    expect(getStartedChargeableKilometers(20.95)).toBe(1);
    expect(getStartedChargeableKilometers(21)).toBe(1);
  });

  it("rounds up each additional started kilometer above 20 km", () => {
    expect(getStartedChargeableKilometers(21.01)).toBe(2);
    expect(getStartedChargeableKilometers(21.95)).toBe(2);
    expect(getStartedChargeableKilometers(100.2)).toBe(81);
  });
});

describe("getFullChargeableKilometers", () => {
  it("returns 0 at or below the free 20 km", () => {
    expect(getFullChargeableKilometers(0)).toBe(0);
    expect(getFullChargeableKilometers(19)).toBe(0);
    expect(getFullChargeableKilometers(20)).toBe(0);
    expect(getFullChargeableKilometers(Number.NaN)).toBe(0);
  });

  it("charges every started kilometer of the full distance once over 20 km", () => {
    expect(getFullChargeableKilometers(20.01)).toBe(21);
    expect(getFullChargeableKilometers(21)).toBe(21);
    expect(getFullChargeableKilometers(29.4)).toBe(30);
    expect(getFullChargeableKilometers(30)).toBe(30);
    expect(getFullChargeableKilometers(130)).toBe(130);
  });
});

describe("usesFullDistanceKmPricing", () => {
  it("uses the new rule for orders without a creation date (not yet saved)", () => {
    expect(usesFullDistanceKmPricing(undefined)).toBe(true);
    expect(usesFullDistanceKmPricing(null)).toBe(true);
    expect(usesFullDistanceKmPricing("not a date")).toBe(true);
  });

  it("keeps the old rule for orders created before the cutoff", () => {
    const before = new Date(FULL_DISTANCE_KM_PRICING_FROM.getTime() - 1);
    expect(usesFullDistanceKmPricing(before)).toBe(false);
    expect(usesFullDistanceKmPricing(before.toISOString())).toBe(false);
  });

  it("uses the new rule for orders created at or after the cutoff", () => {
    expect(usesFullDistanceKmPricing(FULL_DISTANCE_KM_PRICING_FROM)).toBe(true);
    expect(
      usesFullDistanceKmPricing(
        new Date(FULL_DISTANCE_KM_PRICING_FROM.getTime() + 60_000).toISOString(),
      ),
    ).toBe(true);
  });
});
