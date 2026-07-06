import { describe, expect, it } from "vitest";
import { buildOrderPricingSnapshot } from "@/lib/orders/orderTotals";

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
