import { describe, expect, it } from "vitest";

import { toAccountingOrder, type AccountingOrderRecord } from "./accountingOrder";

const updatedAt = new Date("2026-11-02T10:00:00.000Z");

function order(overrides: Partial<AccountingOrderRecord> = {}): AccountingOrderRecord {
  return {
    id: "order-1",
    displayId: 20614,
    status: "Fakturert",
    deliveryDate: "2026-11-02",
    priceExVat: 1000,
    priceSubcontractor: 600,
    pricingSnapshot: null,
    rabatt: null,
    leggTil: null,
    subcontractorMinus: null,
    subcontractorPlus: null,
    websiteOrderKind: null,
    isWebsiteOrder: false,
    productCardsSnapshot: null,
    items: [],
    subcontractor: "NORDLINE AS",
    subcontractorMembershipId: "m-partner",
    priceListId: "pl-1",
    createdByMembershipId: "m-creator",
    customerMembershipId: null,
    createdByMembership: { user: { username: "POWER Rud", email: "rud@power.no" } },
    customerMembership: null,
    updatedAt,
    ...overrides,
  };
}

const context = {
  priceListNames: new Map([["pl-1", "Hvitevarer prisliste"]]),
};

describe("toAccountingOrder", () => {
  it("returns the export's fields with prices in cents", () => {
    expect(toAccountingOrder(order(), context)).toEqual({
      id: "order-1",
      displayId: 20614,
      status: "invoiced",
      deliveryDate: "2026-11-02",
      store: { id: "m-creator", name: "POWER Rud" },
      partner: { id: "m-partner", name: "NORDLINE AS" },
      priceList: { id: "pl-1", name: "Hvitevarer prisliste" },
      priceExVatCents: 100000,
      partnerPriceCents: 60000,
      isWebsiteOrder: false,
      updatedAt: "2026-11-02T10:00:00.000Z",
    });
  });

  it("uses the assigned store before the account that created the order", () => {
    const row = toAccountingOrder(
      order({
        customerMembershipId: "m-store",
        customerMembership: { user: { username: null, email: "elkjop-lorenskog@example.no" } },
        createdByMembership: { user: { username: "Otman admin", email: "admin@otman.no" } },
      }),
      context,
    );
    expect(row.store).toEqual({ id: "m-store", name: "elkjop-lorenskog@example.no" });
  });

  it("applies the discount, extra and partner adjustments like the export", () => {
    const row = toAccountingOrder(
      order({ rabatt: "100", leggTil: "50", subcontractorMinus: "20", subcontractorPlus: "5" }),
      context,
    );
    expect(row.priceExVatCents).toBe(95000);
    expect(row.partnerPriceCents).toBe(58500);
  });

  it("prefers the pricing snapshot's totals and keeps øre", () => {
    const row = toAccountingOrder(
      order({ pricingSnapshot: { customer: { totalExVat: 1206.5 }, subcontractor: { total: 722.25 } } }),
      context,
    );
    expect(row.priceExVatCents).toBe(120650);
    expect(row.partnerPriceCents).toBe(72225);
  });

  it("gives no partner or price list when the order has none", () => {
    const row = toAccountingOrder(order({ subcontractor: "  ", subcontractorMembershipId: null, priceListId: null }), context);
    expect(row.partner).toBeNull();
    expect(row.priceList).toBeNull();
  });

  it("keeps a partner typed by name without an account", () => {
    const row = toAccountingOrder(order({ subcontractorMembershipId: null }), context);
    expect(row.partner).toEqual({ id: null, name: "NORDLINE AS" });
  });
});
