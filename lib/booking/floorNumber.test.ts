import { describe, expect, it } from "vitest";
import { costliestFloor, parseFloorNumber } from "./floorNumber";

describe("costliestFloor", () => {
  it("picks the floor with the bigger no-lift surcharge, basements included", () => {
    expect(costliestFloor(-3, 1)).toBe(-3);
    expect(costliestFloor(4, -2)).toBe(4);
    expect(costliestFloor(1, 5)).toBe(5);
  });

  it("falls back to the higher floor when neither costs more", () => {
    expect(costliestFloor(1, 2)).toBe(2);
    expect(costliestFloor(-1, 2)).toBe(2);
    expect(costliestFloor(0, 0)).toBe(0);
  });
});

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
