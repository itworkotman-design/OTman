import { describe, expect, it } from "vitest";
import { movingEditBody, type MovingEditDraft } from "./movingEditBody";

const draft: MovingEditDraft = {
  edit: {
    pickupAddress: "Karl Johans gate 1, Oslo",
    deliveryAddress: "Storgata 1, Oslo",
    origin: { homeType: "APARTMENT", sizeOptionCode: "SIZE_UNDER_40", floors: 1, floorNumber: 1, hasLift: null, parking: "OUTSIDE" },
    destination: { homeType: "DETACHED", sizeOptionCode: "SIZE_UNDER_40", floors: 2, floorNumber: null, hasLift: null, parking: "OUTSIDE" },
    serviceCodes: [],
  },
  customer: { name: "Kari", phone: "+47 12345678", email: "kari@example.com", comments: "" },
};

describe("movingEditBody (the admin's moving edit tab → PUT …/moving-details)", () => {
  it("is empty when nothing changed", () => {
    expect(movingEditBody(draft, structuredClone(draft))).toEqual({});
  });

  it("sends the move only when it changed, so an untouched move is never re-priced", () => {
    const next = structuredClone(draft);
    next.customer.comments = "Piano";
    expect(movingEditBody(draft, next)).toEqual({ customer: next.customer });
  });

  it("sends the whole move when any part of it changed", () => {
    const next = structuredClone(draft);
    next.edit.serviceCodes = ["SERVICE_FLYTTEVASK"];
    expect(movingEditBody(draft, next)).toEqual({ edit: next.edit });
  });
});
