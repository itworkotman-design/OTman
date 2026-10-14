import { describe, expect, it } from "vitest";
import { movingEditBlockers, movingEditBody, type MovingEditDraft } from "./movingEditBody";

const draft: MovingEditDraft = {
  edit: {
    pickupAddress: "Karl Johans gate 1, Oslo",
    deliveryAddress: "Storgata 1, Oslo",
    origin: { homeType: "APARTMENT", sizeOptionCode: "SIZE_UNDER_40", floors: 1, floorNumber: 1, hasLift: null, parking: "OUTSIDE" },
    destination: { homeType: "DETACHED", sizeOptionCode: "SIZE_UNDER_40", floors: 2, floorNumber: null, hasLift: null, parking: "OUTSIDE" },
    serviceCodes: [],
  },
  customer: { name: "Kari", phone: "+47 12345678", email: "kari@example.com", comments: "" },
  customerType: "private",
  schedule: { preferredDate: "2026-10-22", timeWindow: "10:00-16:00" },
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

describe("movingEditBody — date, time and customer type (as the delivery Edit tab)", () => {
  it("sends the date and time window when they changed", () => {
    const next = structuredClone(draft);
    next.schedule = { preferredDate: "2026-10-25", timeWindow: "16:00-21:00" };
    expect(movingEditBody(draft, next)).toEqual({ preferredDate: "2026-10-25", timeWindow: "16:00-21:00" });
  });

  it("sends the customer type when it changed", () => {
    const next = structuredClone(draft);
    next.customerType = "business";
    expect(movingEditBody(draft, next)).toEqual({ customerType: "business" });
  });
});

describe("movingEditBlockers (what keeps Save disabled)", () => {
  it("is empty for a complete move", () => {
    expect(movingEditBlockers(draft)).toEqual([]);
  });

  it("names an end without an address, size or parking", () => {
    const next = structuredClone(draft);
    next.edit.pickupAddress = " ";
    next.edit.destination = { ...next.edit.destination, sizeOptionCode: null, parking: null };
    expect(movingEditBlockers(next)).toEqual([
      { end: "origin", field: "address" },
      { end: "destination", field: "sizeOptionCode" },
      { end: "destination", field: "parking" },
    ]);
  });

  it("asks for the lift on an apartment above the ground floor, like the booking flow", () => {
    const next = structuredClone(draft);
    next.edit.origin = { ...next.edit.origin, floorNumber: 3, hasLift: null };
    expect(movingEditBlockers(next)).toEqual([{ end: "origin", field: "hasLift" }]);
  });

  it("wants a complete time window", () => {
    const next = structuredClone(draft);
    next.schedule.timeWindow = "12:00-";
    expect(movingEditBlockers(next)).toEqual([{ end: null, field: "timeWindow" }]);
  });
});
