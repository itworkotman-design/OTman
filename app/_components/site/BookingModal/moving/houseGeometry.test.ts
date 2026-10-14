import { describe, expect, it } from "vitest";
import { MOVING_SIZE_OPTIONS } from "@/lib/content/movingCatalog";
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
    const large = houseGeometry("SIZE_OVER_150", 1);
    expect(large.width).toBeGreaterThan(small.width);
    expect(large.windowsPerFloor).toBeGreaterThan(small.windowsPerFloor);
  });

  it("draws every size bracket a step wider than the one before", () => {
    const widths = MOVING_SIZE_OPTIONS.map((o) => houseGeometry(o.code, 1).width);
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeGreaterThan(widths[i - 1]);
  });

  it("gives a wider house a taller roof so it doesn't look flat", () => {
    const rise = (code: string) => {
      const { roof } = houseGeometry(code, 1);
      return roof.baseY - roof.peakY;
    };
    expect(rise("SIZE_OVER_150")).toBeGreaterThan(rise("SIZE_UNDER_20"));
  });

  it("uses a medium width when no size is picked yet or the code is unknown", () => {
    expect(houseGeometry(null, 1).width).toBe(houseGeometry("SIZE_UNDER_60", 1).width);
    expect(houseGeometry("SOMETHING_ELSE", 1).width).toBe(houseGeometry("SIZE_UNDER_60", 1).width);
  });

  it("draws a pitched-roof house for Enebolig/Rekkehus and when no type is picked", () => {
    expect(houseGeometry("SIZE_UNDER_40", 1, "DETACHED").variant).toBe("house");
    expect(houseGeometry("SIZE_UNDER_40", 1, "TOWNHOUSE").variant).toBe("townhouse");
    expect(houseGeometry("SIZE_UNDER_40", 1, null).variant).toBe("house");
    expect(houseGeometry("SIZE_UNDER_40", 1).roof.style).toBe("gable");
    expect(houseGeometry("SIZE_UNDER_40", 1, "TOWNHOUSE").roof.style).toBe("gable");
  });

  it("draws a flat-roofed block for Leilighet and Kontor", () => {
    for (const type of ["APARTMENT", "OFFICE"] as const) {
      const g = houseGeometry("SIZE_UNDER_40", 2, type);
      expect(g.roof.style).toBe("flat");
      // Just a parapet, not a pitched roof.
      expect(g.roof.baseY - g.roof.peakY).toBeLessThan(10);
    }
    expect(houseGeometry("SIZE_UNDER_40", 1, "APARTMENT").variant).toBe("apartment");
    expect(houseGeometry("SIZE_UNDER_40", 1, "OFFICE").variant).toBe("office");
  });

  it("centres a townhouse on its front face, since its side wall is hidden by the neighbour", () => {
    const g = houseGeometry("SIZE_OVER_150", 1, "TOWNHOUSE");
    expect(g.x + g.width / 2).toBeCloseTo(g.viewBoxWidth / 2);
  });

  it("keeps the floor stack identical across types, so switching type only restyles it", () => {
    const house = houseGeometry("SIZE_UNDER_60", 3, "DETACHED");
    const office = houseGeometry("SIZE_UNDER_60", 3, "OFFICE");
    expect(office.floors).toEqual(house.floors);
    expect(office.x).toBe(house.x);
    expect(office.width).toBe(house.width);
  });

  it("clamps the floor count", () => {
    expect(houseGeometry("SIZE_UNDER_40", 99).floors).toHaveLength(HOUSE_MAX_FLOORS);
  });

  it("fits every floor, the side wall and the roof (incl. its back ridge) inside the viewBox", () => {
    const g = houseGeometry("SIZE_OVER_150", HOUSE_MAX_FLOORS);
    expect(g.roof.peakY - g.depth.dy).toBeGreaterThanOrEqual(0);
    expect(g.roof.leftX).toBeGreaterThanOrEqual(0);
    expect(g.roof.rightX + g.depth.dx).toBeLessThanOrEqual(g.viewBoxWidth);
    expect(g.groundY).toBeLessThanOrEqual(g.viewBoxHeight);
  });

  describe("surrounding building (apartment/office on a known floor)", () => {
    it("has none for houses or townhouses", () => {
      expect(houseGeometry("SIZE_UNDER_40", 1, "DETACHED", 3).building).toBeNull();
      expect(houseGeometry("SIZE_UNDER_40", 1, "TOWNHOUSE", 3).building).toBeNull();
      expect(houseGeometry("SIZE_UNDER_40", 1, null, 3).building).toBeNull();
    });

    it("shows an apartment/office on the ground floor of its block while the floor box is empty", () => {
      for (const floor of [null, undefined, 0]) {
        const b = houseGeometry("SIZE_UNDER_40", 1, "APARTMENT", floor).building;
        expect(b).toEqual(houseGeometry("SIZE_UNDER_40", 1, "APARTMENT", 1).building);
      }
      expect(houseGeometry("SIZE_UNDER_40", 1, "OFFICE").building).not.toBeNull();
    });

    it("marks the unit's own floors, starting at the picked floor (1 = ground floor)", () => {
      const b = houseGeometry("SIZE_UNDER_40", 2, "APARTMENT", 3).building!;
      const unit = b.levels.filter((l) => l.isUnit);
      expect(unit.map((l) => l.floorNumber)).toEqual([3, 4]);
    });

    it("keeps the ground in place for a ground-floor unit and fills floors above it", () => {
      const b = houseGeometry("SIZE_UNDER_40", 1, "OFFICE", 1).building!;
      expect(b.groundY).toBe(houseGeometry("SIZE_UNDER_40", 1, "OFFICE").groundY);
      const lowest = b.levels[0];
      expect(lowest.floorNumber).toBe(1);
      expect(lowest.isUnit).toBe(true);
      expect(lowest.isGround).toBe(true);
      expect(b.levels.filter((l) => !l.isUnit).length).toBeGreaterThan(0);
      expect(b.fadeBottom).toBe(false);
    });

    it("draws the floors below a higher unit down to the ground", () => {
      const b = houseGeometry("SIZE_UNDER_40", 1, "APARTMENT", 2).building!;
      expect(b.levels.map((l) => l.floorNumber).slice(0, 2)).toEqual([1, 2]);
      expect(b.levels[0].isUnit).toBe(false);
      expect(b.levels[0].isGround).toBe(true);
    });

    it("stacks the levels bottom-up with no gaps", () => {
      const { levels } = houseGeometry("SIZE_UNDER_40", 2, "APARTMENT", 5).building!;
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i].y + levels[i].height).toBe(levels[i - 1].y);
      }
    });

    it("fills the whole box: some level reaches past the top and past the bottom (or the ground)", () => {
      for (const floor of [1, 2, 7, 40, 999, -1]) {
        const g = houseGeometry("SIZE_UNDER_40", 1, "APARTMENT", floor);
        const b = g.building!;
        const top = b.levels[b.levels.length - 1];
        expect(top.y - g.depth.dy).toBeLessThanOrEqual(0);
        const bottom = b.levels[0];
        expect(bottom.y + bottom.height >= g.viewBoxHeight || bottom.y + bottom.height === b.groundY || bottom.isUnit).toBe(true);
      }
    });

    it("scrolls a high unit into view instead of drawing every floor below it", () => {
      const g = houseGeometry("SIZE_UNDER_40", 1, "APARTMENT", 40);
      const b = g.building!;
      const unit = b.levels.find((l) => l.isUnit)!;
      expect(unit.y).toBeGreaterThan(0);
      expect(unit.y + unit.height).toBeLessThan(g.viewBoxHeight);
      expect(b.levels.length).toBeLessThan(15);
      expect(b.groundY).toBeGreaterThan(g.viewBoxHeight);
      expect(b.fadeBottom).toBe(true);
    });

    it("keeps a unit spanning several floors whole and centred in the box", () => {
      for (const unitFloors of [1, 2, 3, 4]) {
        for (const floor of [3, 5, 12, -1]) {
          const g = houseGeometry("SIZE_UNDER_40", unitFloors, "APARTMENT", floor);
          const unit = g.building!.levels.filter((l) => l.isUnit);
          expect(unit).toHaveLength(unitFloors);
          const top = Math.min(...unit.map((l) => l.y));
          const bottom = Math.max(...unit.map((l) => l.y + l.height));
          // Clear of the faded top edge, and inside the box at the bottom.
          expect(top).toBeGreaterThanOrEqual(g.viewBoxHeight * 0.2);
          expect(bottom).toBeLessThanOrEqual(g.viewBoxHeight);
        }
      }
    });

    it("keeps the unit at the same height when only the floor number changes high up", () => {
      const centre = (floor: number) => {
        const unit = houseGeometry("SIZE_UNDER_40", 3, "APARTMENT", floor).building!.levels.filter((l) => l.isUnit);
        return (Math.min(...unit.map((l) => l.y)) + Math.max(...unit.map((l) => l.y + l.height))) / 2;
      };
      expect(centre(8)).toBe(centre(20));
    });

    it("puts a basement unit below the ground line, with the ground floor above it", () => {
      const g = houseGeometry("SIZE_UNDER_40", 1, "APARTMENT", -1);
      const b = g.building!;
      const unit = b.levels.find((l) => l.isUnit)!;
      expect(unit.floorNumber).toBe(-1);
      expect(unit.isBasement).toBe(true);
      expect(unit.y).toBe(b.groundY);
      // Nothing drawn below the unit itself.
      expect(b.levels[0]).toBe(unit);
      const ground = b.levels.find((l) => l.floorNumber === 1)!;
      expect(ground.isGround).toBe(true);
      expect(ground.y + ground.height).toBe(b.groundY);
      expect(unit.y + unit.height).toBeLessThanOrEqual(g.viewBoxHeight);
    });
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
