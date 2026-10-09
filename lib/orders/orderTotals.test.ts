import { describe, expect, it } from "vitest";
import { buildOrderPricingSnapshot, getOrderChargeAmountIncVatNok, getOrderRemainingBalanceIncVatNok, getPricingSnapshotCustomerVatTotals } from "@/lib/orders/orderTotals";

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
  // Homepage catalog prices are stored VAT-inclusive (see vatDisplayTotal.ts),
  // so the client total the customer saw is what they pay — no extra 25%.
  const websiteOrder = {
    priceExVat: 2855,
    rabatt: null,
    leggTil: null,
    pricingSnapshot: { customer: { totalExVat: 2855, totalIncVat: 3568.75 } },
    websiteOrderKind: "WHITE_GOODS",
  };

  it("charges the client total as-is, not plus VAT", () => {
    expect(getOrderChargeAmountIncVatNok(websiteOrder)).toBe(2855);
  });

  it("falls back to the adjusted priceExVat, without adding VAT, when there's no snapshot", () => {
    const order = { ...websiteOrder, priceExVat: 1000, rabatt: "100", pricingSnapshot: null };
    expect(getOrderChargeAmountIncVatNok(order)).toBe(900);
  });

  it("uses the client total for the remaining balance too", () => {
    expect(getOrderRemainingBalanceIncVatNok(websiteOrder, 200000)).toBe(855);
  });

  it("leaves other orders charging their ex-VAT total plus VAT", () => {
    const order = { priceExVat: 1000, rabatt: null, leggTil: null, pricingSnapshot: null, websiteOrderKind: null };
    expect(getOrderChargeAmountIncVatNok(order)).toBe(1250);
  });
});

describe("getPricingSnapshotCustomerVatTotals", () => {
  const snapshot = { customer: { totalExVat: 44255, vat: 11063.75, totalIncVat: 55318.75 } };

  it("treats a homepage (WHITE_GOODS) total as VAT-inclusive — no VAT on top", () => {
    expect(getPricingSnapshotCustomerVatTotals(snapshot, "WHITE_GOODS")).toEqual({ totalIncVat: 44255, vat: 8851 });
  });

  it("uses the snapshot's own VAT for every other order", () => {
    expect(getPricingSnapshotCustomerVatTotals(snapshot, null)).toEqual({ totalIncVat: 55318.75, vat: 11063.75 });
  });

  it("returns null without a snapshot total", () => {
    expect(getPricingSnapshotCustomerVatTotals(null, "WHITE_GOODS")).toBeNull();
    expect(getPricingSnapshotCustomerVatTotals({ customer: {} }, null)).toBeNull();
  });
});
