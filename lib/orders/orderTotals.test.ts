import { describe, expect, it } from "vitest";
import { buildOrderPricingSnapshot, getOrderChargeAmountIncVatNok, getOrderRemainingBalanceIncVatNok, getPricingSnapshotCustomerVatTotals } from "@/lib/orders/orderTotals";

describe("buildOrderPricingSnapshot — a website order's total incl. VAT", () => {
  it("keeps the incl.-VAT total it's given (summed per line) and the VAT in it", () => {
    const snapshot = buildOrderPricingSnapshot({
      lines: [],
      rabatt: null,
      leggTil: null,
      subcontractorMinus: null,
      subcontractorPlus: null,
      fallbackCustomerTotalExVat: 2256,
      fallbackSubcontractorTotal: 0,
      customerTotalIncVat: 2821,
    });
    expect(snapshot.customer).toMatchObject({ totalExVat: 2256, totalIncVat: 2821, vat: 565 });
  });
});

describe("buildOrderPricingSnapshot", () => {
  it("uses submitted totals as authoritative when line prices are partial", () => {
    const snapshot = buildOrderPricingSnapshot({
      lines: [
        {
          quantity: 1,
          customerPriceCents: 35000,
          subcontractorPriceCents: 20000,
        },
      ],
      rabatt: "1519",
      leggTil: "",
      subcontractorMinus: "",
      subcontractorPlus: "",
      fallbackCustomerTotalExVat: 300,
      fallbackSubcontractorTotal: 900,
    });

    expect(snapshot.customer.subtotalExVat).toBe(1819);
    expect(snapshot.customer.totalExVat).toBe(300);
    expect(snapshot.subcontractor.subtotal).toBe(900);
    expect(snapshot.subcontractor.total).toBe(900);
  });

  it("calculates final totals from line prices when submitted totals are unavailable", () => {
    const snapshot = buildOrderPricingSnapshot({
      lines: [
        {
          quantity: 1,
          customerPriceCents: 181900,
          subcontractorPriceCents: 90000,
        },
      ],
      rabatt: "1519",
      leggTil: "",
      subcontractorMinus: "",
      subcontractorPlus: "",
    });

    expect(snapshot.customer.subtotalExVat).toBe(1819);
    expect(snapshot.customer.totalExVat).toBe(300);
    expect(snapshot.subcontractor.total).toBe(900);
  });

  it("treats an explicit 0 fallback as authoritative, not as 'no fallback' — callers must omit the key entirely to fall back to line summation", () => {
    // This is the exact contract that caused a real bug: a caller with no
    // real total to submit passed 0 "to mean nothing", and it silently
    // discarded correctly-priced line items instead of summing them.
    const snapshot = buildOrderPricingSnapshot({
      lines: [
        {
          quantity: 1,
          customerPriceCents: 66900,
          subcontractorPriceCents: 45000,
        },
      ],
      rabatt: "",
      leggTil: "",
      subcontractorMinus: "",
      subcontractorPlus: "",
      fallbackCustomerTotalExVat: 0,
      fallbackSubcontractorTotal: 0,
    });

    expect(snapshot.customer.totalExVat).toBe(0);
    expect(snapshot.subcontractor.total).toBe(0);
  });

  it("preserves submitted final totals when line prices are unavailable", () => {
    const snapshot = buildOrderPricingSnapshot({
      lines: [],
      rabatt: "1519",
      leggTil: "",
      subcontractorMinus: "100",
      subcontractorPlus: "",
      fallbackCustomerTotalExVat: 300,
      fallbackSubcontractorTotal: 800,
    });

    expect(snapshot.customer.subtotalExVat).toBe(1819);
    expect(snapshot.customer.totalExVat).toBe(300);
    expect(snapshot.subcontractor.subtotal).toBe(900);
    expect(snapshot.subcontractor.total).toBe(800);
  });
});

describe("getOrderRemainingBalanceIncVatNok", () => {
  const baseOrder = { priceExVat: 1000, rabatt: null, leggTil: null, pricingSnapshot: null };

  it("returns the full incl.-VAT total when nothing has been paid yet", () => {
    // 1000 ex VAT -> 1250 incl VAT.
    expect(getOrderRemainingBalanceIncVatNok(baseOrder, 0)).toBe(1250);
  });

  it("subtracts what's already been paid", () => {
    expect(getOrderRemainingBalanceIncVatNok(baseOrder, 50000)).toBe(750);
  });

  it("returns 0, never negative, once the order is fully paid or overpaid", () => {
    expect(getOrderRemainingBalanceIncVatNok(baseOrder, 125000)).toBe(0);
    expect(getOrderRemainingBalanceIncVatNok(baseOrder, 999999)).toBe(0);
  });

  it("uses the order's pricingSnapshot total when available, same as getOrderChargeAmountIncVatNok", () => {
    const order = {
      ...baseOrder,
      pricingSnapshot: { customer: { totalIncVat: 2000 } },
    };
    expect(getOrderRemainingBalanceIncVatNok(order, 60000)).toBe(1400);
  });
});

describe("getOrderChargeAmountIncVatNok for homepage website orders", () => {
  // Website orders store their prices ex. VAT like every other order; the
  // customer pays the snapshot's incl.-VAT total (summed per line, rounded
  // to whole kroner — see lib/booking/pricing/websiteVat.ts).
  const websiteOrder = {
    priceExVat: 2284,
    rabatt: null,
    leggTil: null,
    pricingSnapshot: { customer: { totalExVat: 2284, totalIncVat: 2856 } },
    websiteOrderKind: "WHITE_GOODS",
  };

  it("charges the snapshot's total incl. VAT", () => {
    expect(getOrderChargeAmountIncVatNok(websiteOrder)).toBe(2856);
  });

  it("falls back to the adjusted priceExVat plus VAT when there's no snapshot", () => {
    const order = { ...websiteOrder, priceExVat: 1000, rabatt: "100", pricingSnapshot: null };
    expect(getOrderChargeAmountIncVatNok(order)).toBe(1125);
  });

  it("uses the total incl. VAT for the remaining balance too", () => {
    expect(getOrderRemainingBalanceIncVatNok(websiteOrder, 200000)).toBe(856);
  });

  it("leaves other orders charging their ex-VAT total plus VAT", () => {
    const order = { priceExVat: 1000, rabatt: null, leggTil: null, pricingSnapshot: null, websiteOrderKind: null };
    expect(getOrderChargeAmountIncVatNok(order)).toBe(1250);
  });
});

describe("getPricingSnapshotCustomerVatTotals", () => {
  const snapshot = { customer: { totalExVat: 44255, vat: 11063.75, totalIncVat: 55318.75 } };

  it("uses the snapshot's own VAT for a homepage (WHITE_GOODS) order too — stored ex. VAT like the rest", () => {
    expect(getPricingSnapshotCustomerVatTotals(snapshot, "WHITE_GOODS")).toEqual({ totalIncVat: 55318.75, vat: 11063.75 });
  });

  it("uses the snapshot's own VAT for every other order", () => {
    expect(getPricingSnapshotCustomerVatTotals(snapshot, null)).toEqual({ totalIncVat: 55318.75, vat: 11063.75 });
  });

  it("returns null without a snapshot total", () => {
    expect(getPricingSnapshotCustomerVatTotals(null, "WHITE_GOODS")).toBeNull();
    expect(getPricingSnapshotCustomerVatTotals({ customer: {} }, null)).toBeNull();
  });
});
