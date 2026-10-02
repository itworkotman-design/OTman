import { describe, expect, it } from "vitest";
import { isOrderDetailsStepReady } from "./orderDetailsReady";

const ready = {
  deliveryAddress: "Storgata 10, Lillestrøm",
  deliveryAddressSelected: true,
  deliveryFloor: 1,
  preferredDate: "2026-10-05",
  timeWindow: "10:00-16:00",
};

describe("isOrderDetailsStepReady", () => {
  it("is ready once every required field is filled in", () => {
    expect(isOrderDetailsStepReady(ready)).toBe(true);
  });

  it("needs a delivery address picked from the suggestions", () => {
    expect(isOrderDetailsStepReady({ ...ready, deliveryAddress: " " })).toBe(false);
    expect(isOrderDetailsStepReady({ ...ready, deliveryAddressSelected: false })).toBe(false);
  });

  it("needs a delivery floor, which can't be 0", () => {
    expect(isOrderDetailsStepReady({ ...ready, deliveryFloor: null })).toBe(false);
    expect(isOrderDetailsStepReady({ ...ready, deliveryFloor: 0 })).toBe(false);
  });

  it("accepts a basement (negative) delivery floor", () => {
    expect(isOrderDetailsStepReady({ ...ready, deliveryFloor: -1 })).toBe(true);
  });

  it("needs a date and a complete time window", () => {
    expect(isOrderDetailsStepReady({ ...ready, preferredDate: "" })).toBe(false);
    expect(isOrderDetailsStepReady({ ...ready, timeWindow: "" })).toBe(false);
    expect(isOrderDetailsStepReady({ ...ready, timeWindow: "12:00-" })).toBe(false);
  });
});
