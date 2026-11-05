import { describe, expect, it } from "vitest";
import { movingOrderDescription } from "./movingOrderDescription";

describe("movingOrderDescription", () => {
  it("lists from, to, additional services and notes", () => {
    expect(
      movingOrderDescription({
        originLine: "Apartment, Under 40 m², 1 floor, lift: no, parking: within 50 m",
        destinationLine: "Detached house, Under 100 m², 2 floors, parking: right outside",
        serviceLabels: ["Packing", "Move-out cleaning"],
        notes: "Piano in the living room",
      }),
    ).toBe(
      "Moving from: Apartment, Under 40 m², 1 floor, lift: no, parking: within 50 m\n\n" +
        "Moving to: Detached house, Under 100 m², 2 floors, parking: right outside\n\n" +
        "Additional services: Packing, Move-out cleaning\n\n" +
        "Piano in the living room",
    );
  });

  it("puts each end's comment under it", () => {
    expect(
      movingOrderDescription({ originLine: "A", destinationLine: "B", serviceLabels: [], notes: null, pickupComment: "Kodelås 1234", deliveryComment: " Ring på " }),
    ).toBe("Moving from: A\n    *comment: Kodelås 1234\n\nMoving to: B\n    *comment: Ring på");
  });

  it("leaves out services and notes when missing", () => {
    expect(
      movingOrderDescription({ originLine: "A", destinationLine: "B", serviceLabels: [], notes: null }),
    ).toBe("Moving from: A\n\nMoving to: B");
  });
});
