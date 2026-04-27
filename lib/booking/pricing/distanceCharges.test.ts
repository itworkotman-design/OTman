import { describe, expect, it } from "vitest";

import { getStartedChargeableKilometers } from "./distanceCharges";

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
