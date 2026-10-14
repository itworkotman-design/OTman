import { describe, expect, it } from "vitest";
import {
  MOVING_HOME_TYPES,
  MOVING_PARKING_OPTIONS,
  emptyMovingProperty,
  isMovingEndReady,
  movingChargeableFloors,
  movingLiftApplies,
  movingPropertyLine,
  parseMovingProperty,
} from "./movingProperty";

const apartment = {
  homeType: "APARTMENT",
  sizeOptionCode: "SIZE_UNDER_40",
  floors: 1,
  hasLift: true,
  parking: "WITHIN_50M",
};

describe("MOVING_HOME_TYPES / MOVING_PARKING_OPTIONS", () => {
  it("offers Leilighet, Rekkehus, Enebolig and Kontor", () => {
    expect(MOVING_HOME_TYPES.map((h) => h.labelNo)).toEqual(["Leilighet", "Rekkehus", "Enebolig", "Kontor"]);
  });

  it("offers parking by carrying distance", () => {
    expect(MOVING_PARKING_OPTIONS.map((p) => p.labelNo)).toEqual(["Rett utenfor", "Innen 50 m", "Lenger unna"]);
  });
});

describe("movingLiftApplies", () => {
  it("only asks about a lift for apartments and offices", () => {
    expect(movingLiftApplies("APARTMENT")).toBe(true);
    expect(movingLiftApplies("OFFICE")).toBe(true);
    expect(movingLiftApplies("TOWNHOUSE")).toBe(false);
    expect(movingLiftApplies("DETACHED")).toBe(false);
    expect(movingLiftApplies(null)).toBe(false);
  });
});

describe("parseMovingProperty", () => {
  it("accepts a complete apartment", () => {
    const result = parseMovingProperty(apartment);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.property.homeType.code).toBe("APARTMENT");
    expect(result.property.sizeOptionCode).toBe("SIZE_UNDER_40");
    expect(result.property.floors).toBe(1);
    expect(result.property.hasLift).toBe(true);
    expect(result.property.parking.code).toBe("WITHIN_50M");
  });

  it("requires the lift answer for an apartment/office", () => {
    const result = parseMovingProperty({ ...apartment, hasLift: null });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.hasLift).toBeDefined();
  });

  it("ignores (nulls) a lift answer for a house — the question isn't shown", () => {
    const result = parseMovingProperty({ ...apartment, homeType: "DETACHED", hasLift: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.property.hasLift).toBeNull();
  });

  it("reports every missing or invalid field", () => {
    const result = parseMovingProperty({ homeType: "CASTLE", sizeOptionCode: "", floors: 9, parking: "ROOF" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["floors", "homeType", "parking", "sizeOptionCode"]);
  });

  it("rejects a non-object", () => {
    expect(parseMovingProperty(undefined).ok).toBe(false);
    expect(parseMovingProperty("APARTMENT").ok).toBe(false);
  });

  it("treats the empty draft the flow starts from as incomplete", () => {
    expect(parseMovingProperty(emptyMovingProperty()).ok).toBe(false);
    expect(emptyMovingProperty().floors).toBe(1);
  });
});

describe("movingPropertyLine", () => {
  it("summarises an apartment with lift and parking", () => {
    const result = parseMovingProperty(apartment);
    if (!result.ok) throw new Error("expected ok");
    expect(movingPropertyLine(result.property, "Under 40 m²")).toBe(
      "Apartment, Under 40 m², 1 floor, lift: yes, parking: within 50 m",
    );
  });

  it("leaves out the lift for a house and pluralises floors", () => {
    const result = parseMovingProperty({ ...apartment, homeType: "DETACHED", floors: 2, parking: "OUTSIDE" });
    if (!result.ok) throw new Error("expected ok");
    expect(movingPropertyLine(result.property, "Under 100 m²")).toBe(
      "Detached house, Under 100 m², 2 floors, parking: right outside",
    );
  });
});

describe("isMovingEndReady", () => {
  const complete = { ...apartment } as Parameters<typeof isMovingEndReady>[0]["property"];

  it("is ready once the address was picked from the suggestions and every answer is in", () => {
    expect(isMovingEndReady({ address: "Storgata 1, Oslo", addressSelected: true, property: complete })).toBe(true);
  });

  it("isn't ready for a free-typed address that was never picked — same as the delivery modal", () => {
    expect(isMovingEndReady({ address: "Storgata 1", addressSelected: false, property: complete })).toBe(false);
  });

  it("isn't ready without an address or with an unanswered question", () => {
    expect(isMovingEndReady({ address: "  ", addressSelected: true, property: complete })).toBe(false);
    expect(
      isMovingEndReady({ address: "Storgata 1, Oslo", addressSelected: true, property: { ...complete, parking: null } }),
    ).toBe(false);
  });
});

describe("floor number (no lift)", () => {
  const noLift = { ...apartment, hasLift: false, floorNumber: 4 };

  it("asks which floor when an apartment/office has no lift", () => {
    const result = parseMovingProperty({ ...noLift, floorNumber: null });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.floorNumber).toBe("Required");
  });

  it("accepts a whole, non-zero floor (negative = basement)", () => {
    expect(parseMovingProperty(noLift).ok).toBe(true);
    expect(parseMovingProperty({ ...noLift, floorNumber: -2 }).ok).toBe(true);
    expect(parseMovingProperty({ ...noLift, floorNumber: 0 }).ok).toBe(false);
    expect(parseMovingProperty({ ...noLift, floorNumber: 2.5 }).ok).toBe(false);
    expect(parseMovingProperty({ ...noLift, floorNumber: 1000 }).ok).toBe(false);
  });

  it("ignores (nulls) the floor when there is a lift or no lift question", () => {
    const withLift = parseMovingProperty({ ...noLift, hasLift: true });
    const house = parseMovingProperty({ ...noLift, homeType: "DETACHED", hasLift: null });
    expect(withLift.ok && withLift.property.floorNumber).toBeNull();
    expect(house.ok && house.property.floorNumber).toBeNull();
  });

  it("charges floors like delivery: free up to the 2nd, then per floor above it", () => {
    const at = (floorNumber: number) => {
      const result = parseMovingProperty({ ...noLift, floorNumber });
      if (!result.ok) throw new Error("expected ok");
      return movingChargeableFloors(result.property);
    };
    expect(at(1)).toBe(0);
    expect(at(2)).toBe(0);
    expect(at(4)).toBe(2);
    expect(at(-1)).toBe(0);
    expect(at(-3)).toBe(2);
  });

  it("charges nothing with a lift", () => {
    const result = parseMovingProperty({ ...noLift, hasLift: true });
    if (!result.ok) throw new Error("expected ok");
    expect(movingChargeableFloors(result.property)).toBe(0);
  });

  it("mentions the floor in the staff line", () => {
    const result = parseMovingProperty(noLift);
    if (!result.ok) throw new Error("expected ok");
    expect(movingPropertyLine(result.property, "Under 40 m²")).toBe(
      "Apartment, Under 40 m², 1 floor, lift: no (on floor 4), parking: within 50 m",
    );
  });

  it("starts empty in the flow's draft", () => {
    expect(emptyMovingProperty().floorNumber).toBeNull();
  });
});
