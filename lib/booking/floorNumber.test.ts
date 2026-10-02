import { describe, expect, it } from "vitest";
import { parseFloorNumber } from "./floorNumber";

describe("parseFloorNumber", () => {
  it("keeps whole floors above and below ground", () => {
    expect(parseFloorNumber(3)).toBe(3);
    expect(parseFloorNumber(-1)).toBe(-1);
    expect(parseFloorNumber("-2")).toBe(-2);
  });

  it("falls back to 0 (not given) for anything that isn't a whole number", () => {
    expect(parseFloorNumber(undefined)).toBe(0);
    expect(parseFloorNumber(null)).toBe(0);
    expect(parseFloorNumber("")).toBe(0);
    expect(parseFloorNumber("abc")).toBe(0);
    expect(parseFloorNumber(2.5)).toBe(0);
    expect(parseFloorNumber(Infinity)).toBe(0);
  });
});
