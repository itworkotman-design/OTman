import { describe, expect, it } from "vitest";
import {
  movingAdjustmentsFromOrder,
  movingCustomerLiveTotals,
  movingLineKey,
  movingLineKeyFor,
  movingNulledFromDraft,
  movingOrderAdjustedPricing,
  movingOrderCalculatorView,
  movingPriceChanges,
} from "./movingOrderCalculator";
import { movingOrderPricing } from "./movingOrderPricing";

const row = (productCode: string, optionCode: string, optionLabel: string, customerPriceCents: number, subcontractorPriceCents: number, quantity = 1) => ({
  cardId: 0,
  productCode,
  productName: productCode,
  itemType: "product",
  optionCode,
  optionLabel,
  quantity,
  customerPriceCents,
  subcontractorPriceCents,
});

// Size + a service on the move, a floor surcharge (2 floors) and the km as order extras.
const items = [
  row("MOVING_BY_SIZE", "MOVING_SIZE_2", "2-room flat", 500_000, 350_000),
  row("MOVING_ADDITIONAL_SERVICES", "MOVING_PACKING", "Packing", 100_000, 70_000),
  row("MOVING_FLOOR_SURCHARGE", "MOVING_FLOOR", "Floor surcharge, moving from (2 floors)", 20_000, 15_000, 2),
  row("MOVING_DISTANCE", "MOVING_KM_21", "Distance (30 km)", 1_000, 800, 30),
];
const none = { rabatt: "", leggTil: "", subcontractorMinus: "", subcontractorPlus: "" };

describe("movingOrderCalculatorView", () => {
  it("shows the move and its extras like the delivery calculator, every line with its code and both prices", () => {
    const view = movingOrderCalculatorView(items, none, { includePartner: true });
    expect(view.products).toEqual([
      {
        name: "Moving",
        isOrderExtras: false,
        cardId: 0,
        lines: [
          { label: "2-room flat", code: "MOVING_SIZE_2", qty: 1, customer: 5000, partner: 3500, lineKey: "MOVING_BY_SIZE:MOVING_SIZE_2", nulledCustomer: false, nulledPartner: false },
          { label: "Packing", code: "MOVING_PACKING", qty: 1, customer: 1000, partner: 700, lineKey: "MOVING_ADDITIONAL_SERVICES:MOVING_PACKING", nulledCustomer: false, nulledPartner: false },
        ],
      },
      {
        name: "Order extras",
        isOrderExtras: true,
        cardId: null,
        lines: [
          { label: "Floor surcharge, moving from (2 floors)", code: "MOVING_FLOOR", qty: 2, customer: 400, partner: 300, lineKey: "MOVING_FLOOR_SURCHARGE:MOVING_FLOOR:from", nulledCustomer: false, nulledPartner: false },
          { label: "Distance (30 km)", code: "MOVING_KM_21", qty: 30, customer: 300, partner: 240, lineKey: "MOVING_DISTANCE:MOVING_KM_21", nulledCustomer: false, nulledPartner: false },
        ],
      },
    ]);
    expect(view.customer).toEqual({ subtotal: 6700, discount: 0, extra: 0, total: 6700, totalIncVat: 8375 });
    expect(view.partner).toEqual({ base: 4740, minus: 0, plus: 0, total: 4740 });
  });

  it("takes the discount and extra off / onto the customer's total, incl. VAT the same way", () => {
    const view = movingOrderCalculatorView(items, { ...none, rabatt: "500", leggTil: "100" }, { includePartner: true });
    expect(view.customer).toEqual({ subtotal: 6700, discount: 500, extra: 100, total: 6300, totalIncVat: 8375 - 625 + 125 });
  });

  it("takes the partner minus and plus off / onto the partner's total", () => {
    const view = movingOrderCalculatorView(items, { ...none, subcontractorMinus: "300", subcontractorPlus: "50" }, { includePartner: true });
    expect(view.partner).toEqual({ base: 4740, minus: 300, plus: 50, total: 4490 });
  });

  it("leaves the partner side out for who may not see it", () => {
    const view = movingOrderCalculatorView(items, none, { includePartner: false });
    expect(view.partner).toBeNull();
    expect(view.products.flatMap((p) => p.lines).every((line) => line.partner === null)).toBe(true);
  });

  it("has no order-extras group when the move has none", () => {
    const view = movingOrderCalculatorView(items.slice(0, 1), none, { includePartner: true });
    expect(view.products.map((p) => p.name)).toEqual(["Moving"]);
  });
});

describe("movingOrderAdjustedPricing", () => {
  it("prices a move without adjustments exactly like a booking does", () => {
    const booked = movingOrderPricing(
      { code: "MOVING_SIZE_2", labelEn: "2-room flat", customerPriceCents: 500_000, subcontractorPriceCents: 350_000 },
      [
        { code: "MOVING_PACKING", labelEn: "Packing", customerPriceCents: 100_000, subcontractorPriceCents: 70_000 },
        { code: "MOVING_FLOOR", labelEn: "Floor", customerPriceCents: 40_000, subcontractorPriceCents: 30_000 },
        { code: "MOVING_KM_21", labelEn: "Distance", customerPriceCents: 30_000, subcontractorPriceCents: 24_000 },
      ],
      items,
    );
    expect(movingOrderAdjustedPricing(items, none)).toEqual(booked);
  });

  it("stores the discount, extra and partner minus/plus in the totals and the snapshot", () => {
    const priced = movingOrderAdjustedPricing(items, { rabatt: "500", leggTil: "100", subcontractorMinus: "300", subcontractorPlus: "50" });
    expect(priced.priceExVat).toBe(6300);
    expect(priced.priceSubcontractor).toBe(4490);
    expect(priced.pricingSnapshot.customer).toMatchObject({ subtotalExVat: 6700, discount: 500, extra: 100, totalExVat: 6300, totalIncVat: 7875 });
    expect(priced.pricingSnapshot.subcontractor).toEqual({ subtotal: 4740, minus: 300, plus: 50, total: 4490 });
  });
});

describe("movingLineKey", () => {
  it("is the line's product and option code, plus which end for a per-end surcharge", () => {
    expect(movingLineKey({ productCode: "MOVING_BY_SIZE", optionCode: "S2", optionLabel: "2-room flat" })).toBe("MOVING_BY_SIZE:S2");
    expect(movingLineKey({ productCode: "MOVING_CARRY_SURCHARGE", optionCode: "C", optionLabel: "Carry 20 m, moving to" })).toBe(
      "MOVING_CARRY_SURCHARGE:C:to",
    );
  });

  it("stays the same when the floor count in the label changes", () => {
    const a = movingLineKey({ productCode: "MOVING_FLOOR_SURCHARGE", optionCode: "F", optionLabel: "Floor surcharge, moving from (2 floors)" });
    const b = movingLineKey({ productCode: "MOVING_FLOOR_SURCHARGE", optionCode: "F", optionLabel: "Floor surcharge, moving from (3 floors)" });
    expect(a).toBe(b);
  });
});

describe("Set to 0 on a move", () => {
  const sizeKey = "MOVING_BY_SIZE:MOVING_SIZE_2";
  const kmKey = "MOVING_DISTANCE:MOVING_KM_21";

  it("zeroes a line set to 0 for the customer and leaves it out of the totals, like the delivery engine", () => {
    const view = movingOrderCalculatorView(items, { ...none, nulledLines: { customer: [sizeKey], subcontractor: [] } }, { includePartner: true });
    expect(view.products[0].lines[0]).toMatchObject({ customer: 0, partner: 3500, nulledCustomer: true, nulledPartner: false });
    expect(view.customer).toMatchObject({ subtotal: 1700, total: 1700, totalIncVat: 1250 + 500 + 375 });
    expect(view.partner?.total).toBe(4740);
  });

  it("zeroes a line set to 0 for the partner only on the partner side", () => {
    const view = movingOrderCalculatorView(items, { ...none, nulledLines: { customer: [], subcontractor: [kmKey] } }, { includePartner: true });
    expect(view.products[1].lines[1]).toMatchObject({ customer: 300, partner: 0, nulledPartner: true });
    expect(view.partner?.total).toBe(4500);
    expect(view.customer.total).toBe(6700);
  });

  it("stores the lines set to 0 on the snapshot, read back with the order's other adjustments", () => {
    const priced = movingOrderAdjustedPricing(items, { ...none, nulledLines: { customer: [sizeKey], subcontractor: [sizeKey] } });
    expect(priced.priceExVat).toBe(1700);
    expect(priced.priceSubcontractor).toBe(1240);
    const adjustments = movingAdjustmentsFromOrder({ rabatt: "50", leggTil: null, subcontractorMinus: null, subcontractorPlus: null, pricingSnapshot: priced.pricingSnapshot });
    expect(adjustments).toEqual({ rabatt: "50", leggTil: null, subcontractorMinus: null, subcontractorPlus: null, nulledLines: { customer: [sizeKey], subcontractor: [sizeKey] } });
  });

  it("reads no lines set to 0 from an order without them", () => {
    expect(movingAdjustmentsFromOrder({ rabatt: null, leggTil: null, subcontractorMinus: null, subcontractorPlus: null, pricingSnapshot: null }).nulledLines).toEqual({
      customer: [],
      subcontractor: [],
    });
  });

  it("takes the calculator's choices (the move's card and its order extras) as one list per side", () => {
    expect(
      movingNulledFromDraft({ cards: { 0: { customer: [sizeKey], subcontractor: [sizeKey] } }, orderExtras: { customer: [kmKey], subcontractor: [] } }),
    ).toEqual({ customer: [sizeKey, kmKey], subcontractor: [sizeKey] });
  });
});

describe("movingPriceChanges (\"Use new price\" on a move)", () => {
  const today = items.map((item) => (item.optionCode === "MOVING_SIZE_2" ? { ...item, customerPriceCents: 550_000, subcontractorPriceCents: 360_000 } : item));

  it("names each line priced differently today than it was saved", () => {
    expect(movingPriceChanges(items, today, { includePartner: true })).toEqual([
      { productName: "Moving", label: "2-room flat", saved: 5000, now: 5500, savedPartner: 3500, nowPartner: 3600 },
    ]);
  });

  it("is empty when nothing moved", () => {
    expect(movingPriceChanges(items, items, { includePartner: true })).toEqual([]);
  });

  it("lists a line that's only charged today (or no longer), at 0 on the other side", () => {
    const changes = movingPriceChanges(items.slice(0, 3), items, { includePartner: true });
    expect(changes).toEqual([{ productName: null, label: "Distance (30 km)", saved: 0, now: 300, savedPartner: 0, nowPartner: 240 }]);
  });

  it("leaves the partner prices out for who may not see them — and partner-only changes", () => {
    const partnerOnly = items.map((item) => (item.optionCode === "MOVING_PACKING" ? { ...item, subcontractorPriceCents: 1 } : item));
    expect(movingPriceChanges(items, partnerOnly, { includePartner: false })).toEqual([]);
    expect(movingPriceChanges(items, today, { includePartner: false })).toEqual([
      { productName: "Moving", label: "2-room flat", saved: 5000, now: 5500, savedPartner: null, nowPartner: null },
    ]);
  });
});

describe("movingCustomerLiveTotals (the customer's live price in \"My order\")", () => {
  const lines = [
    { key: "MOVING_BY_SIZE:S", customerPriceCents: 500_000 },
    { key: "MOVING_ADDITIONAL_SERVICES:P", customerPriceCents: 100_000 },
  ];

  it("is the lines' total when staff set nothing", () => {
    expect(movingCustomerLiveTotals(lines, null)).toEqual({ totalExVat: 6000, totalIncVat: 7500, discount: 0, extra: 0, nulledKeys: [] });
  });

  it("takes off a staff discount, adds an extra and leaves lines set to 0 out — what the server prices", () => {
    const context = { rabatt: "500", leggTil: "100", nulledLineKeys: ["MOVING_ADDITIONAL_SERVICES:P"] };
    expect(movingCustomerLiveTotals(lines, context)).toEqual({
      totalExVat: 5000 - 500 + 100,
      totalIncVat: 6250 - 625 + 125,
      discount: 500,
      extra: 100,
      nulledKeys: ["MOVING_ADDITIONAL_SERVICES:P"],
    });
  });
});

describe("movingLineKeyFor (the booking flow's lines)", () => {
  it("gives the key a stored line of the same kind gets", () => {
    expect(movingLineKeyFor("MOVING_FLOOR_SURCHARGE", "F", "to")).toBe(
      movingLineKey({ productCode: "MOVING_FLOOR_SURCHARGE", optionCode: "F", optionLabel: "Floor surcharge, moving to (1 floor)" }),
    );
    expect(movingLineKeyFor("MOVING_BY_SIZE", "S2")).toBe(movingLineKey({ productCode: "MOVING_BY_SIZE", optionCode: "S2", optionLabel: "2-room flat" }));
  });
});
