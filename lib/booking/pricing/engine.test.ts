import { describe, expect, it } from "vitest";

import { calculateBookingPricing } from "./engine";

describe("calculateBookingPricing", () => {
  it("allows customer and subcontractor totals to go negative when adjustments exceed the base price", () => {
    const result = calculateBookingPricing({
      productBreakdowns: [
        {
          productName: "Ettermontering",
          items: [
            {
              kind: "customPrice",
              code: "DELIVERY",
              label: "Ettermontering (DELIVERY)",
              qty: 1,
              unitPrice: 590,
              subcontractorUnitPrice: 590,
            },
            {
              kind: "customPrice",
              code: "ANDRE",
              label: "Snekker/ Rørlegger (ANDRE)",
              qty: 0.5,
              unitPrice: 600,
              subcontractorUnitPrice: 600,
            },
          ],
        },
      ],
      priceLookup: {},
      adjustments: {
        rabatt: "1780",
        leggTil: "",
        subcontractorMinus: "1780",
        subcontractorPlus: "",
      },
    });

    expect(result.totals.subtotalExVat).toBe(890);
    expect(result.totals.totalExVat).toBe(-890);
    expect(result.totals.vat).toBe(-222.5);
    expect(result.totals.totalIncVat).toBe(-1112.5);
    expect(result.totals.subcontractorTotal).toBe(-890);
  });

  it("applies manual plus adjustments for native calculator flows", () => {
    const result = calculateBookingPricing({
      productBreakdowns: [
        {
          productName: "Washer",
          items: [
            {
              kind: "customPrice",
              code: "DELIVERY",
              label: "Delivery",
              qty: 1,
              unitPrice: 1000,
              subcontractorUnitPrice: 600,
            },
          ],
        },
      ],
      priceLookup: {},
      adjustments: {
        rabatt: "100",
        leggTil: "500",
        subcontractorMinus: "50",
        subcontractorPlus: "250",
      },
    });

    expect(result.totals.discount).toBe(100);
    expect(result.totals.extra).toBe(500);
    expect(result.totals.totalExVat).toBe(1400);
    expect(result.totals.subcontractorMinus).toBe(50);
    expect(result.totals.subcontractorPlus).toBe(250);
    expect(result.totals.subcontractorTotal).toBe(800);
  });
});
