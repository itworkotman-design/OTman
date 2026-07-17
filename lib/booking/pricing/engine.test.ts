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

  it("zeroes only the targeted line's customer total when its key is in nulledLineKeysForCustomer, leaving the other line and subcontractor totals untouched", () => {
    const result = calculateBookingPricing({
      productBreakdowns: [
        {
          productName: "Sofa",
          cardId: 1,
          nulledLineKeysForCustomer: ["code:SOFA"],
          items: [
            {
              kind: "customPrice",
              code: "SOFA",
              label: "Sofa delivery",
              qty: 1,
              unitPrice: 1000,
              subcontractorUnitPrice: 400,
            },
            {
              kind: "customPrice",
              code: "CUSHION",
              label: "Cushion",
              qty: 1,
              unitPrice: 300,
              subcontractorUnitPrice: 100,
            },
          ],
        },
      ],
      priceLookup: {},
      adjustments: {},
    });

    expect(result.breakdowns[0].lines[0].lineTotal).toBe(0);
    expect(result.breakdowns[0].lines[0].subcontractorLineTotal).toBe(400);
    expect(result.breakdowns[0].lines[0].nulledForCustomer).toBe(true);
    expect(result.breakdowns[0].lines[1].lineTotal).toBe(300);
    expect(result.breakdowns[0].lines[1].nulledForCustomer).toBe(false);
    expect(result.totals.subtotalExVat).toBe(300);
    expect(result.totals.totalExVat).toBe(300);
    expect(result.totals.subcontractorBase).toBe(500);
    expect(result.totals.subcontractorTotal).toBe(500);
    expect(result.totals.checkboxDiscount).toBe(1000);
    expect(result.totals.subcontractorCheckboxDiscount).toBe(0);
  });

  it("zeroes a line's subcontractor total when its key is in nulledLineKeysForSubcontractor, leaving customer total untouched", () => {
    const result = calculateBookingPricing({
      productBreakdowns: [
        {
          productName: "Sofa",
          cardId: 1,
          nulledLineKeysForSubcontractor: ["code:SOFA"],
          items: [
            {
              kind: "customPrice",
              code: "SOFA",
              label: "Sofa delivery",
              qty: 1,
              unitPrice: 1000,
              subcontractorUnitPrice: 400,
            },
          ],
        },
      ],
      priceLookup: {},
      adjustments: {},
    });

    expect(result.breakdowns[0].lines[0].lineTotal).toBe(1000);
    expect(result.breakdowns[0].lines[0].subcontractorLineTotal).toBe(0);
    expect(result.breakdowns[0].lines[0].nulledForSubcontractor).toBe(true);
    expect(result.totals.subtotalExVat).toBe(1000);
    expect(result.totals.subcontractorBase).toBe(0);
    expect(result.totals.subcontractorTotal).toBe(0);
    expect(result.totals.checkboxDiscount).toBe(0);
    expect(result.totals.subcontractorCheckboxDiscount).toBe(400);
  });

  it("sums the raw (pre-null) amounts of every nulled line into checkboxDiscount/subcontractorCheckboxDiscount, independently per side", () => {
    const result = calculateBookingPricing({
      productBreakdowns: [
        {
          productName: "Sofa",
          cardId: 1,
          nulledLineKeysForCustomer: ["code:SOFA"],
          items: [
            {
              kind: "customPrice",
              code: "SOFA",
              label: "Sofa delivery",
              qty: 1,
              unitPrice: 1000,
              subcontractorUnitPrice: 400,
            },
          ],
        },
        {
          productName: "Table",
          cardId: 2,
          nulledLineKeysForCustomer: ["code:TABLE"],
          nulledLineKeysForSubcontractor: ["code:TABLE"],
          items: [
            {
              kind: "customPrice",
              code: "TABLE",
              label: "Table delivery",
              qty: 1,
              unitPrice: 500,
              subcontractorUnitPrice: 200,
            },
          ],
        },
      ],
      priceLookup: {},
      adjustments: {},
    });

    expect(result.totals.checkboxDiscount).toBe(1500);
    expect(result.totals.subcontractorCheckboxDiscount).toBe(200);
  });

  it("applies manual discount adjustments on top of the post-null subtotal", () => {
    const result = calculateBookingPricing({
      productBreakdowns: [
        {
          productName: "Sofa",
          cardId: 1,
          nulledLineKeysForCustomer: ["code:SOFA"],
          nulledLineKeysForSubcontractor: ["code:SOFA"],
          items: [
            {
              kind: "customPrice",
              code: "SOFA",
              label: "Sofa delivery",
              qty: 1,
              unitPrice: 1000,
              subcontractorUnitPrice: 400,
            },
          ],
        },
      ],
      priceLookup: {},
      adjustments: {
        rabatt: "100",
        subcontractorMinus: "50",
      },
    });

    expect(result.totals.subtotalExVat).toBe(0);
    expect(result.totals.totalExVat).toBe(-100);
    expect(result.totals.subcontractorBase).toBe(0);
    expect(result.totals.subcontractorTotal).toBe(-50);
  });

  it("computes lineKey as opt:<productOptionId> for productOption items, matched via priceLookup", () => {
    const result = calculateBookingPricing({
      productBreakdowns: [
        {
          productName: "Sofa",
          cardId: 1,
          nulledLineKeysForCustomer: ["opt:install-1"],
          items: [
            {
              kind: "productOption",
              productOptionId: "install-1",
              qty: 1,
            },
          ],
        },
      ],
      priceLookup: {
        "install-1": {
          label: "Install",
          code: "INSTALL",
          customerPrice: 200,
          subcontractorPrice: 80,
        },
      },
      adjustments: {},
    });

    expect(result.breakdowns[0].lines[0].lineTotal).toBe(0);
    expect(result.breakdowns[0].lines[0].subcontractorLineTotal).toBe(80);
    expect(result.totals.subtotalExVat).toBe(0);
    expect(result.totals.subcontractorBase).toBe(80);
  });
});
