import { describe, expect, it } from "vitest";
import { isModelNumberEnabled } from "./modelNumber";

const deliveryTypes = [
  { key: "INDOOR", enabled: true, allowModelNumber: true },
  { key: "FIRST_STEP", enabled: true, allowModelNumber: false },
];

describe("isModelNumberEnabled", () => {
  it("uses the product flag when delivery types are off", () => {
    expect(isModelNumberEnabled({ allowModelNumber: true, allowDeliveryTypes: false, deliveryTypes: [] }, "")).toBe(true);
    expect(isModelNumberEnabled({ allowModelNumber: false, allowDeliveryTypes: false, deliveryTypes: [] }, "")).toBe(false);
  });

  it("lets the delivery type decide when delivery types are on, even if the hidden product flag is off", () => {
    const product = { allowModelNumber: false, allowDeliveryTypes: true, deliveryTypes };
    expect(isModelNumberEnabled(product, "INDOOR")).toBe(true);
    expect(isModelNumberEnabled(product, "FIRST_STEP")).toBe(false);
  });

  it("is off when delivery types are on but none (or an unknown/disabled one) is selected", () => {
    const product = { allowModelNumber: true, allowDeliveryTypes: true, deliveryTypes };
    expect(isModelNumberEnabled(product, "")).toBe(false);
    expect(isModelNumberEnabled(product, "RETURN_ONLY")).toBe(false);
    expect(
      isModelNumberEnabled(
        { ...product, deliveryTypes: [{ key: "INDOOR", enabled: false, allowModelNumber: true }] },
        "INDOOR",
      ),
    ).toBe(false);
  });

  it("is off without a product", () => {
    expect(isModelNumberEnabled(null, "INDOOR")).toBe(false);
  });
});
