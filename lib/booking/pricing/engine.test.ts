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
});
