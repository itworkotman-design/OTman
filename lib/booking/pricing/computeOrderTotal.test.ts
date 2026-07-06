import { describe, expect, it } from "vitest";
import { computeFullOrderTotal } from "./computeOrderTotal";
import { createDefaultPriceListSettings } from "@/lib/products/priceListSettings";

describe("computeFullOrderTotal", () => {
  it("includes order-level extras (express delivery, extra pickup) in the total, not just product lines", () => {
    // Reproduces the automatic-orders bug: the archive/order total only
    // reflected per-product-card lines and silently dropped order-level
    // fees that BookingEditor's "Order extras" section shows.
    const priceListSettings = createDefaultPriceListSettings();
    priceListSettings.expressDelivery.price = "500";
    priceListSettings.expressDelivery.subcontractorPrice = "250";
    priceListSettings.extraPickup.price = "590";
    priceListSettings.extraPickup.subcontractorPrice = "390";

    const result = computeFullOrderTotal({
      productCards: [],
      catalogProducts: [],
      catalogSpecialOptions: [],
      priceListSettings,
      deviation: "",
      drivingDistance: "",
      expressDelivery: true,
      extraWorkMinutes: 0,
      feeAddToOrder: false,
      feeExtraWork: false,
      extraPickups: [{ address: "Some street 1" }],
      rabatt: null,
      leggTil: null,
      subcontractorMinus: null,
      subcontractorPlus: null,
    });

    expect(result.totalExVat).toBe(1090);
    expect(result.subcontractorTotal).toBe(640);
  });

  it("returns 0 when there are no product lines and no order extras apply", () => {
    const result = computeFullOrderTotal({
      productCards: [],
      catalogProducts: [],
      catalogSpecialOptions: [],
      priceListSettings: createDefaultPriceListSettings(),
      deviation: "",
      drivingDistance: "",
      expressDelivery: false,
      extraWorkMinutes: 0,
      feeAddToOrder: false,
      feeExtraWork: false,
      extraPickups: [],
      rabatt: null,
      leggTil: null,
      subcontractorMinus: null,
      subcontractorPlus: null,
    });

    expect(result.totalExVat).toBe(0);
    expect(result.subcontractorTotal).toBe(0);
  });

  it("applies rabatt/leggTil adjustments on top of the full total", () => {
    const priceListSettings = createDefaultPriceListSettings();
    priceListSettings.expressDelivery.price = "500";

    const result = computeFullOrderTotal({
      productCards: [],
      catalogProducts: [],
      catalogSpecialOptions: [],
      priceListSettings,
      deviation: "",
      drivingDistance: "",
      expressDelivery: true,
      extraWorkMinutes: 0,
      feeAddToOrder: false,
      feeExtraWork: false,
      extraPickups: [],
      rabatt: "100",
      leggTil: "50",
      subcontractorMinus: null,
      subcontractorPlus: null,
    });

    expect(result.totalExVat).toBe(450);
  });
});
