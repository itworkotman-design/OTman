import { describe, expect, it } from "vitest";
import { optionalCoordinate } from "@/lib/orders/normalizeOrderInput";

describe("optionalCoordinate", () => {
  it("returns a valid number within range", () => {
    expect(optionalCoordinate(59.9139, -90, 90)).toBe(59.9139);
  });

  it("parses a numeric string within range", () => {
    expect(optionalCoordinate("10.7522", -180, 180)).toBe(10.7522);
  });

  it("returns null for a number outside the range", () => {
    expect(optionalCoordinate(120, -90, 90)).toBeNull();
    expect(optionalCoordinate(-190, -180, 180)).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(optionalCoordinate("not a number", -90, 90)).toBeNull();
    expect(optionalCoordinate(undefined, -90, 90)).toBeNull();
    expect(optionalCoordinate(null, -90, 90)).toBeNull();
    expect(optionalCoordinate({}, -90, 90)).toBeNull();
  });

  it("returns null for non-finite numbers", () => {
    expect(optionalCoordinate(Number.NaN, -90, 90)).toBeNull();
    expect(optionalCoordinate(Number.POSITIVE_INFINITY, -90, 90)).toBeNull();
  });
});
