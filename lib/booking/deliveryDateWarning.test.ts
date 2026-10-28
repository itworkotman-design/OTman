import { describe, expect, it } from "vitest";
import { getDeliveryDateWarning } from "./deliveryDateWarning";

describe("getDeliveryDateWarning", () => {
  const base = { today: "2026-10-28", deliveryDateChanged: true, allowPastDeliveryDates: true };

  it("warns for a past date when past dates are allowed", () => {
    expect(getDeliveryDateWarning({ ...base, deliveryDate: "2026-10-27" })).toBe("Warning: delivery date is in the past");
  });

  it("does not warn for a past date when past dates are not allowed (it's a validation error instead)", () => {
    expect(getDeliveryDateWarning({ ...base, allowPastDeliveryDates: false, deliveryDate: "2026-10-27" })).toBeNull();
  });

  it("warns for today regardless of past-date permission", () => {
    expect(getDeliveryDateWarning({ ...base, deliveryDate: "2026-10-28" })).toBe("Warning: delivery date is today");
    expect(getDeliveryDateWarning({ ...base, allowPastDeliveryDates: false, deliveryDate: "2026-10-28" })).toBe(
      "Warning: delivery date is today",
    );
  });

  it("does not warn for future or empty dates", () => {
    expect(getDeliveryDateWarning({ ...base, deliveryDate: "2026-10-29" })).toBeNull();
    expect(getDeliveryDateWarning({ ...base, deliveryDate: "  " })).toBeNull();
  });

  it("does not warn when the date was not changed from the saved value", () => {
    expect(getDeliveryDateWarning({ ...base, deliveryDateChanged: false, deliveryDate: "2026-10-27" })).toBeNull();
    expect(getDeliveryDateWarning({ ...base, deliveryDateChanged: false, deliveryDate: "2026-10-28" })).toBeNull();
  });
});
