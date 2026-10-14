import { describe, expect, it } from "vitest";
import {
  MOVING_HOME_TYPES,
  MOVING_PARKING_OPTIONS,
  emptyMovingProperty,
  isMovingEndReady,
  isMovingEndWhereReady,
  movingChargeableFloors,
  movingDraftChargeableFloors,
  movingLiftApplies,
  movingPropertyLine,
  parseMovingProperty,
} from "./movingProperty";

const apartment = {
  homeType: "APARTMENT",
  sizeOptionCode: "SIZE_UNDER_40",
  floors: 1,
  floorNumber: 2,
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
      "Apartment, Under 40 m², 1 floor, on floor 2, lift: yes, parking: within 50 m",
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

describe("floor number (apartment/office — asked before the lift)", () => {
  const noLift = { ...apartment, hasLift: false, floorNumber: 4 };

  it("asks which floor for every apartment/office, lift or not", () => {
    for (const hasLift of [true, false]) {
      const result = parseMovingProperty({ ...noLift, hasLift, floorNumber: null });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.floorNumber).toBe("Required");
    }
  });

  it("accepts a whole, non-zero floor (negative = basement)", () => {
    expect(parseMovingProperty(noLift).ok).toBe(true);
    expect(parseMovingProperty({ ...noLift, floorNumber: -2 }).ok).toBe(true);
    expect(parseMovingProperty({ ...noLift, floorNumber: 0 }).ok).toBe(false);
    expect(parseMovingProperty({ ...noLift, floorNumber: 2.5 }).ok).toBe(false);
    expect(parseMovingProperty({ ...noLift, floorNumber: 1000 }).ok).toBe(false);
  });

  it("keeps the floor with a lift too, and nulls it for a house (not asked)", () => {
    const withLift = parseMovingProperty({ ...noLift, hasLift: true });
    const house = parseMovingProperty({ ...noLift, homeType: "DETACHED", hasLift: null });
    expect(withLift.ok && withLift.property.floorNumber).toBe(4);
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
      "Apartment, Under 40 m², 1 floor, on floor 4, lift: no, parking: within 50 m",
    );
  });

  it("starts empty in the flow's draft", () => {
    expect(emptyMovingProperty().floorNumber).toBeNull();
  });
});

describe("movingDraftChargeableFloors (live calculator)", () => {
  const draft = { ...emptyMovingProperty(), homeType: "APARTMENT" as const, hasLift: false, floorNumber: 5 };

  it("counts the surcharge as soon as lift + floor are answered — before parking or size", () => {
    expect(movingDraftChargeableFloors(draft)).toBe(3);
  });

  it("follows every floor change", () => {
    expect(movingDraftChargeableFloors({ ...draft, floorNumber: 3 })).toBe(1);
    expect(movingDraftChargeableFloors({ ...draft, floorNumber: 6 })).toBe(4);
  });

  it("ignores a leftover 'no lift' answer after switching to a house, and a lift", () => {
    expect(movingDraftChargeableFloors({ ...draft, homeType: "DETACHED" })).toBe(0);
    expect(movingDraftChargeableFloors({ ...draft, hasLift: true })).toBe(0);
    expect(movingDraftChargeableFloors({ ...draft, floorNumber: null })).toBe(0);
  });
});

describe("parking → carrying-distance surcharge", () => {
  it("maps each parking answer to its surcharge line (right outside is free)", () => {
    expect(MOVING_PARKING_OPTIONS.map((p) => [p.code, p.surchargeCode])).toEqual([
      ["OUTSIDE", null],
      ["WITHIN_50M", "CARRY_WITHIN_50M"],
      ["FURTHER", "CARRY_FURTHER"],
    ]);
  });
});

describe("isMovingEndWhereReady (address + type section)", () => {
  const draft = { ...emptyMovingProperty(), homeType: "APARTMENT" as const };

  it("is ready once the address is picked from the suggestions and a type chosen — nothing else needed yet", () => {
    expect(isMovingEndWhereReady({ address: "Storgata 1, Oslo", addressSelected: true, property: draft })).toBe(true);
  });

  it("isn't ready with a free-typed address, no address, or no type", () => {
    expect(isMovingEndWhereReady({ address: "Storgata 1", addressSelected: false, property: draft })).toBe(false);
    expect(isMovingEndWhereReady({ address: " ", addressSelected: true, property: draft })).toBe(false);
    expect(
      isMovingEndWhereReady({ address: "Storgata 1, Oslo", addressSelected: true, property: emptyMovingProperty() }),
    ).toBe(false);
  });
});
