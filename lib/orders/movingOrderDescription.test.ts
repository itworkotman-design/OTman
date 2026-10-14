import { describe, expect, it } from "vitest";
import { MOVING_HOME_TYPES, movingOrderDescription, parseMovingFloors, parseMovingHomeType } from "./movingOrderDescription";

describe("parseMovingFloors", () => {
  it("defaults to null when not sent (older clients)", () => {
    expect(parseMovingFloors(undefined)).toEqual({ ok: true, floors: null });
    expect(parseMovingFloors(null)).toEqual({ ok: true, floors: null });
  });

  it("accepts whole numbers from 1 to 4", () => {
    expect(parseMovingFloors(1)).toEqual({ ok: true, floors: 1 });
    expect(parseMovingFloors(4)).toEqual({ ok: true, floors: 4 });
  });

  it("rejects anything else", () => {
    expect(parseMovingFloors(0).ok).toBe(false);
    expect(parseMovingFloors(5).ok).toBe(false);
    expect(parseMovingFloors(1.5).ok).toBe(false);
    expect(parseMovingFloors("2").ok).toBe(false);
  });
});

describe("movingOrderDescription", () => {
  it("lists size, floors, additional services and notes", () => {
    expect(
      movingOrderDescription({
        sizeLabel: "Under 40 m²",
        floors: 2,
        serviceLabels: ["Packing", "Move-out cleaning"],
        notes: "No lift",
      }),
    ).toBe("Approximate size: Under 40 m²\n\nFloors: 2\n\nAdditional services: Packing, Move-out cleaning\n\nNo lift");
  });

  it("leaves out floors, services and notes when missing", () => {
    expect(movingOrderDescription({ sizeLabel: "Under 40 m²", floors: null, serviceLabels: [], notes: null })).toBe(
      "Approximate size: Under 40 m²",
    );
  });
});

describe("parseMovingHomeType", () => {
  it("offers Leilighet, Rekkehus, Enebolig and Kontor", () => {
    expect(MOVING_HOME_TYPES.map((h) => h.labelNo)).toEqual(["Leilighet", "Rekkehus", "Enebolig", "Kontor"]);
  });

  it("defaults to null when not sent (older clients)", () => {
    expect(parseMovingHomeType(undefined)).toEqual({ ok: true, homeType: null });
    expect(parseMovingHomeType(null)).toEqual({ ok: true, homeType: null });
  });

  it("resolves a known code", () => {
    expect(parseMovingHomeType("APARTMENT")).toEqual({ ok: true, homeType: MOVING_HOME_TYPES[0] });
  });

  it("rejects unknown codes and non-strings", () => {
    expect(parseMovingHomeType("CASTLE").ok).toBe(false);
    expect(parseMovingHomeType(1).ok).toBe(false);
  });
});

describe("movingOrderDescription — home type", () => {
  it("lists the property type right after the size", () => {
    expect(
      movingOrderDescription({ sizeLabel: "Under 40 m²", homeTypeLabel: "Apartment", floors: 1, serviceLabels: [], notes: null }),
    ).toBe("Approximate size: Under 40 m²\n\nProperty type: Apartment\n\nFloors: 1");
  });
});
