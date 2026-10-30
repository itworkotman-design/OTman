import { describe, expect, it } from "vitest";
import { partnerPricesFromCalculator, partnerPricesFromMovingItems, partnerPricesFromServiceItems, partnerViewerRole } from "./partnerOrderView";
import type { AdjustmentLine } from "@/lib/booking/pricing/adjustmentLines";

describe("partnerViewerRole (who opens a website order read-only, and as what)", () => {
  const order = { subcontractorMembershipId: "m-partner", createdByMembershipId: "m-website", customerMembershipId: "m-website" };

  it("lets an owner/admin see any order", () => {
    expect(partnerViewerRole({ id: "m-1", role: "ADMIN", permissions: [] }, order)).toBe("admin");
  });

  it("lets the assigned partner see their own order — as a partner (no customer prices)", () => {
    expect(partnerViewerRole({ id: "m-partner", role: "USER", permissions: [] }, order)).toBe("partner");
    expect(partnerViewerRole({ id: "m-other", role: "USER", permissions: [] }, order)).toBeNull();
  });

  it("lets an order creator see the orders they made, like the booking list", () => {
    expect(partnerViewerRole({ id: "m-website", role: "USER", permissions: ["BOOKING_CREATE"] }, order)).toBe("creator");
    expect(partnerViewerRole({ id: "m-x", role: "USER", permissions: ["BOOKING_CREATE"] }, order)).toBeNull();
  });
});

describe("partnerPricesFromCalculator (a delivery order)", () => {
  const calculator = {
    products: [
      {
        name: "Vaskemaskin",
        isOrderExtras: false,
        cardId: 0,
        lines: [
          { label: "Levering med innbæring", code: "INN", qty: 1, customer: 899, partner: 400, lineKey: null, nulledCustomer: false, nulledPartner: false },
          { label: "Retur", code: "RET", qty: 1, customer: 200, partner: 100, lineKey: null, nulledCustomer: false, nulledPartner: true },
        ],
      },
      {
        name: "Tillegg til ordren",
        isOrderExtras: true,
        cardId: null,
        lines: [{ label: "Etasjetillegg", code: "FLOOR", qty: 2, customer: 142, partner: 60, lineKey: null, nulledCustomer: false, nulledPartner: false }],
      },
    ],
    customer: { subtotal: 1241, discount: 0, extra: 0, total: 1241, totalIncVat: 1551 },
    partner: { base: 460, minus: 0, plus: 0, total: 460 },
  };

  it("lists the partner's price per line, a line set to 0 for the partner at 0, totalling the stored partner price", () => {
    expect(partnerPricesFromCalculator(calculator, 460)).toEqual({
      groups: [
        {
          name: "Vaskemaskin",
          lines: [
            { label: "Levering med innbæring", qty: 1, price: 400 },
            { label: "Retur", qty: 1, price: 0 },
          ],
        },
        { name: "Tillegg til ordren", lines: [{ label: "Etasjetillegg", qty: 2, price: 60 }] },
      ],
      total: 460,
      mismatch: 0,
    });
  });

  it("always shows the stored total (what the partner is paid), and flags lines that don't add up to it", () => {
    const view = partnerPricesFromCalculator(calculator, 500);
    expect(view.total).toBe(500);
    expect(view.mismatch).toBe(40);
  });

  it("includes the partner's minus/plus adjustments as their own lines", () => {
    const adjusted = { ...calculator, partner: { base: 460, minus: 50, plus: 0, total: 410 } };
    const view = partnerPricesFromCalculator(adjusted, 410);
    expect(view.groups.at(-1)).toEqual({ name: "Justering", lines: [{ label: "Partner minus", qty: 1, price: -50 }] });
    expect(view.mismatch).toBe(0);
  });
});

describe("partner adjustment lines (several minus/plus with descriptions, like a regular order)", () => {
  const lines: AdjustmentLine[] = [
    { id: "d1", kind: "discount", description: "Never shown to the partner", amount: 100 },
    { id: "m1", kind: "subcontractorMinus", description: "Late arrival", amount: 30 },
    { id: "m2", kind: "subcontractorMinus", description: "", amount: 20, percent: 5 },
    { id: "p1", kind: "subcontractorPlus", description: "Waiting time", amount: 40 },
  ];

  it("lists each of the partner's own lines, with its description and percent, never the customer's discount", () => {
    const adjusted = {
      products: [
        {
          name: "Vaskemaskin",
          isOrderExtras: false,
          cardId: 0,
          lines: [{ label: "Levering", code: "INN", qty: 1, customer: 899, partner: 460, lineKey: null, nulledCustomer: false, nulledPartner: false }],
        },
      ],
      customer: { subtotal: 899, discount: 100, extra: 0, total: 799, totalIncVat: 999 },
      partner: { base: 460, minus: 50, plus: 40, total: 450 },
    };
    const view = partnerPricesFromCalculator(adjusted, 450, lines);
    expect(view.groups.at(-1)).toEqual({
      name: "Justering",
      lines: [
        { label: "Minus – Late arrival", qty: 1, price: -30 },
        { label: "Minus (5 %)", qty: 1, price: -20 },
        { label: "Pluss – Waiting time", qty: 1, price: 40 },
      ],
    });
    expect(view.mismatch).toBe(0);
  });

  it("does the same for a move", () => {
    const items = [
      { productCode: "MOVING_BY_SIZE", optionCode: "S", optionLabel: "Under 40 m²", quantity: 1, customerPriceCents: 0, subcontractorPriceCents: 300000 },
    ];
    const view = partnerPricesFromMovingItems(
      items,
      2990,
      { rabatt: "100", leggTil: null, subcontractorMinus: "50", subcontractorPlus: "40" },
      lines,
    );
    expect(view.groups.at(-1)?.lines.map((line) => line.label)).toEqual(["Minus – Late arrival", "Minus (5 %)", "Pluss – Waiting time"]);
    expect(view.mismatch).toBe(0);
  });
});

describe("partnerPricesFromMovingItems (a move)", () => {
  const item = (productCode: string, optionLabel: string, quantity: number, subcontractorPriceCents: number) => ({
    productCode,
    optionCode: optionLabel,
    optionLabel,
    quantity,
    customerPriceCents: 0,
    subcontractorPriceCents,
  });

  it("lists the move's partner prices from its stored lines, totalling the stored partner price", () => {
    const items = [item("MOVING_BY_SIZE", "Under 40 m²", 1, 300000), item("MOVING_DISTANCE", "Distance (43 km)", 43, 1651)];
    expect(partnerPricesFromMovingItems(items, 3710)).toEqual({
      groups: [
        { name: "Moving", lines: [{ label: "Under 40 m²", qty: 1, price: 3000 }] },
        { name: "Order extras", lines: [{ label: "Distance (43 km)", qty: 43, price: 710 }] },
      ],
      total: 3710,
      mismatch: 0,
    });
  });

  it("lists the admin calculator's partner minus and plus, so the lines add up to the stored partner price", () => {
    const items = [item("MOVING_BY_SIZE", "Under 40 m²", 1, 300000)];
    const view = partnerPricesFromMovingItems(items, 2800, { rabatt: null, leggTil: null, subcontractorMinus: "300", subcontractorPlus: "100" });
    expect(view.groups.at(-1)).toEqual({
      name: "Justering",
      lines: [
        { label: "Partner minus", qty: 1, price: -300 },
        { label: "Partner plus", qty: 1, price: 100 },
      ],
    });
    expect(view.mismatch).toBe(0);
  });
});

describe("partnerPricesFromServiceItems (a service request)", () => {
  it("lists each quoted service's partner price and express as an extra, as the admin calculator does", () => {
    const items = [
      { productCode: "SERVICE_QUOTE", optionCode: "QUOTE:option-1", optionLabel: "Electrician", quantity: 1, customerPriceCents: 250000, subcontractorPriceCents: 180000 },
      { productCode: "MOVING_EXPRESS", optionCode: "EXPRESS", optionLabel: "Express", quantity: 1, customerPriceCents: 50000, subcontractorPriceCents: 20000 },
    ];
    expect(partnerPricesFromServiceItems(items, 2000)).toEqual({
      groups: [
        { name: "Service", lines: [{ label: "Electrician", qty: 1, price: 1800 }] },
        { name: "Order extras", lines: [{ label: "Express", qty: 1, price: 200 }] },
      ],
      total: 2000,
      mismatch: 0,
    });
  });

  it("shows a service set to 0 for the partner at 0", () => {
    const items = [
      { productCode: "SERVICE_QUOTE", optionCode: "QUOTE:option-1", optionLabel: "Electrician", quantity: 1, customerPriceCents: 250000, subcontractorPriceCents: 180000 },
    ];
    const view = partnerPricesFromServiceItems(items, 0, {
      rabatt: null,
      leggTil: null,
      subcontractorMinus: null,
      subcontractorPlus: null,
      nulledLines: { customer: [], subcontractor: ["SERVICE_QUOTE:QUOTE:option-1"] },
    });
    expect(view.groups[0].lines[0].price).toBe(0);
    expect(view.mismatch).toBe(0);
  });
});
