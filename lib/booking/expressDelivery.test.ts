import { describe, expect, it } from "vitest";
import { isExpressDelivery } from "./expressDelivery";

describe("isExpressDelivery", () => {
  const at = (iso: string) => new Date(iso);

  it("is false without a delivery date", () => {
    expect(isExpressDelivery({ deliveryDate: "", timeWindow: "10:00-16:00", customTimeFrom: "", referenceTime: at("2026-10-28T12:00:00") })).toBe(false);
  });

  it("is true when the window starts less than 24h after the reference time", () => {
    expect(
      isExpressDelivery({ deliveryDate: "2026-10-29", timeWindow: "10:00-16:00", customTimeFrom: "", referenceTime: at("2026-10-28T12:00:00") }),
    ).toBe(true);
  });

  it("is false when the window starts 24h or more after the reference time", () => {
    expect(
      isExpressDelivery({ deliveryDate: "2026-10-29", timeWindow: "16:00-21:00", customTimeFrom: "", referenceTime: at("2026-10-28T12:00:00") }),
    ).toBe(false);
  });

  it("measures from the reference time (e.g. order creation), not from now", () => {
    // Created well before delivery: not express, even though delivery is in the past relative to now.
    expect(
      isExpressDelivery({ deliveryDate: "2026-01-10", timeWindow: "10:00-16:00", customTimeFrom: "", referenceTime: at("2026-01-01T12:00:00") }),
    ).toBe(false);
    // Created the evening before delivery: express.
    expect(
      isExpressDelivery({ deliveryDate: "2026-01-10", timeWindow: "10:00-16:00", customTimeFrom: "", referenceTime: at("2026-01-09T20:00:00") }),
    ).toBe(true);
  });

  it("uses the custom start time for custom windows", () => {
    expect(
      isExpressDelivery({ deliveryDate: "2026-10-29", timeWindow: "custom", customTimeFrom: "11:30", referenceTime: at("2026-10-28T12:00:00") }),
    ).toBe(true);
    expect(
      isExpressDelivery({ deliveryDate: "2026-10-29", timeWindow: "custom", customTimeFrom: "12:30", referenceTime: at("2026-10-28T12:00:00") }),
    ).toBe(false);
  });

  it("is false for a custom window without a valid start time", () => {
    expect(
      isExpressDelivery({ deliveryDate: "2026-10-29", timeWindow: "custom", customTimeFrom: "", referenceTime: at("2026-10-28T12:00:00") }),
    ).toBe(false);
  });
});
