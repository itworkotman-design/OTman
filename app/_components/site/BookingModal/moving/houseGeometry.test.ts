import { describe, expect, it } from "vitest";
import { HOUSE_MAX_FLOORS, HOUSE_MIN_FLOORS, clampFloors, houseGeometry } from "./houseGeometry";

describe("clampFloors", () => {
  it("keeps a value inside the allowed range", () => {
    expect(clampFloors(2)).toBe(2);
  });

  it("clamps below the minimum and above the maximum", () => {
    expect(clampFloors(0)).toBe(HOUSE_MIN_FLOORS);
    expect(clampFloors(HOUSE_MAX_FLOORS + 3)).toBe(HOUSE_MAX_FLOORS);
  });

  it("falls back to one floor for non-numbers and rounds fractions", () => {
    expect(clampFloors(Number.NaN)).toBe(1);
    expect(clampFloors(2.6)).toBe(3);
  });
});

describe("houseGeometry", () => {
  it("stacks one floor rect per story, ground floor at the bottom", () => {
    const g = houseGeometry("SIZE_UNDER_40", 3);
    expect(g.floors).toHaveLength(3);
    expect(g.floors[0].y).toBeGreaterThan(g.floors[1].y);
    expect(g.floors[1].y).toBeGreaterThan(g.floors[2].y);
    expect(g.floors[1].y + g.floors[1].height).toBe(g.floors[0].y);
  });

  it("puts the roof directly on top of the highest floor", () => {
    const g = houseGeometry("SIZE_UNDER_40", 2);
    expect(g.roof.baseY).toBe(g.floors[1].y);
    expect(g.roof.peakY).toBeLessThan(g.roof.baseY);
  });

  it("gets wider (and gets more windows) as the size bracket grows", () => {
    const small = houseGeometry("SIZE_UNDER_20", 1);
    const large = houseGeometry("SIZE_OVER_100", 1);
    expect(large.width).toBeGreaterThan(small.width);
    expect(large.windowsPerFloor).toBeGreaterThan(small.windowsPerFloor);
  });

  it("gives a wider house a taller roof so it doesn't look flat", () => {
    const rise = (code: string) => {
      const { roof } = houseGeometry(code, 1);
      return roof.baseY - roof.peakY;
    };
    expect(rise("SIZE_OVER_100")).toBeGreaterThan(rise("SIZE_UNDER_20"));
  });

  it("uses a medium width when no size is picked yet or the code is unknown", () => {
    expect(houseGeometry(null, 1).width).toBe(houseGeometry("SIZE_UNDER_60", 1).width);
    expect(houseGeometry("SOMETHING_ELSE", 1).width).toBe(houseGeometry("SIZE_UNDER_60", 1).width);
  });

  it("clamps the floor count", () => {
    expect(houseGeometry("SIZE_UNDER_40", 99).floors).toHaveLength(HOUSE_MAX_FLOORS);
  });

  it("fits every floor, the side wall and the roof (incl. its back ridge) inside the viewBox", () => {
    const g = houseGeometry("SIZE_OVER_100", HOUSE_MAX_FLOORS);
    expect(g.roof.peakY - g.depth.dy).toBeGreaterThanOrEqual(0);
    expect(g.roof.leftX).toBeGreaterThanOrEqual(0);
    expect(g.roof.rightX + g.depth.dx).toBeLessThanOrEqual(g.viewBoxWidth);
    expect(g.groundY).toBeLessThanOrEqual(g.viewBoxHeight);
  });

  it("has a 3D depth offset going up and to the right", () => {
    const g = houseGeometry("SIZE_UNDER_40", 1);
    expect(g.depth.dx).toBeGreaterThan(0);
    expect(g.depth.dy).toBeGreaterThan(0);
  });

  it("keeps the whole drawing (front + side) horizontally centred", () => {
    const g = houseGeometry("SIZE_UNDER_40", 1);
    const left = g.roof.leftX;
    const right = g.roof.rightX + g.depth.dx;
    expect((left + right) / 2).toBeCloseTo(g.viewBoxWidth / 2);
  });
});
