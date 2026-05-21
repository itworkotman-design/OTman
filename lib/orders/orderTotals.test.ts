import { describe, expect, it } from "vitest";
import { buildOrderPricingSnapshot } from "@/lib/orders/orderTotals";

describe("buildOrderPricingSnapshot", () => {
  it("calculates final customer total from line subtotal and adjustments", () => {
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
      fallbackCustomerTotalExVat: 300,
      fallbackSubcontractorTotal: 900,
    });

    expect(snapshot.customer.subtotalExVat).toBe(1819);
    expect(snapshot.customer.totalExVat).toBe(300);
    expect(snapshot.subcontractor.total).toBe(900);
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
