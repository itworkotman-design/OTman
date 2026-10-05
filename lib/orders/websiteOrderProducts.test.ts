import { describe, expect, it } from "vitest";
import { checkWebsiteOrderTotals, groupPricingLinesByCard, pricingLinesFromSnapshot, type PricingLine } from "./websiteOrderProducts";

function line(overrides: Partial<PricingLine>): PricingLine {
  return {
    cardId: 0,
    productCode: "WM",
    productName: "Vaskemaskin",
    deliveryType: "INSIDE",
    itemType: "BASE_OPTION",
    optionCode: "",
    optionLabel: "",
    quantity: 1,
    customerUnitPrice: null,
    customerLineTotal: null,
    subcontractorUnitPrice: null,
    subcontractorLineTotal: null,
    ...overrides,
  };
}

describe("groupPricingLinesByCard", () => {
  it("groups lines per product card in order, with a total per card", () => {
    const groups = groupPricingLinesByCard([
      line({ cardId: 0, itemType: "PRODUCT_CARD" }),
      line({ cardId: 0, optionLabel: "Levering med innbæring", customerLineTotal: 899 }),
      line({ cardId: 1, productName: "Sofa", itemType: "PRODUCT_CARD" }),
      line({ cardId: 0, itemType: "EXTRA_OPTION", optionLabel: "Retur av gammel", quantity: 2, customerLineTotal: 400 }),
      line({ cardId: 1, productName: "Sofa", optionLabel: "Levering", customerLineTotal: 1200 }),
    ]);

    expect(groups).toEqual([
      {
        cardId: 0,
        productName: "Vaskemaskin",
        total: 1299,
        items: [
          { label: "Levering med innbæring", qty: 1, price: 899 },
          { label: "Retur av gammel", qty: 2, price: 400 },
        ],
      },
      { cardId: 1, productName: "Sofa", total: 1200, items: [{ label: "Levering", qty: 1, price: 1200 }] },
    ]);
  });

  it("keeps a priced product-card line as an item, labelled with the product", () => {
    const [group] = groupPricingLinesByCard([line({ itemType: "PRODUCT_CARD", customerLineTotal: 500 })]);
    expect(group.items).toEqual([{ label: "Vaskemaskin", qty: 1, price: 500 }]);
  });

  it("falls back to the option code when there's no label, and treats a missing price as 0", () => {
    const [group] = groupPricingLinesByCard([line({ optionCode: "INST1", optionLabel: "" })]);
    expect(group.items).toEqual([{ label: "INST1", qty: 1, price: 0 }]);
    expect(group.total).toBe(0);
  });

  it("is empty for no lines", () => {
    expect(groupPricingLinesByCard([])).toEqual([]);
  });
});

describe("pricingLinesFromSnapshot", () => {
  it("reads the well-formed lines out of a stored snapshot", () => {
    const good = line({ cardId: 2 });
    expect(pricingLinesFromSnapshot({ version: 1, lines: [good, { cardId: "x" }, null] })).toEqual([good]);
  });

  it("is empty for a missing or malformed snapshot", () => {
    expect(pricingLinesFromSnapshot(null)).toEqual([]);
    expect(pricingLinesFromSnapshot({ lines: "nope" })).toEqual([]);
    expect(pricingLinesFromSnapshot([])).toEqual([]);
  });
});

describe("checkWebsiteOrderTotals", () => {
  const products = [{ cardId: 0, productName: "Vaskemaskin", total: 1000, items: [] }];
  const extras = [{ label: "Etasjetillegg", price: 142.42, qty: 2 }];
  const base = { products, orderExtras: extras, rabatt: null, leggTil: null };

  it("is clean when products + extras add up to the order total (to the krone)", () => {
    expect(checkWebsiteOrderTotals({ ...base, total: 1142.42 })).toEqual({
      linesTotal: 1142.42,
      missingFromLines: 0,
      shownTotal: null,
      differsFromShown: 0,
    });
  });

  it("counts a manual discount / surcharge as explained", () => {
    expect(checkWebsiteOrderTotals({ ...base, rabatt: "100", leggTil: "50", total: 1092.42 }).missingFromLines).toBe(0);
  });

  it("reports what the order total holds beyond its lines — lines missing or mispriced", () => {
    // The order from the bug: lines 12 930 (returns at 0), total 12 290.
    expect(checkWebsiteOrderTotals({ ...base, total: 1342.42 }).missingFromLines).toBe(200);
    expect(checkWebsiteOrderTotals({ ...base, total: 942.42 }).missingFromLines).toBe(-200);
  });

  it("compares the order total with what the customer was shown at booking", () => {
    expect(checkWebsiteOrderTotals({ ...base, total: 1142.42, shownTotal: 1142.42 }).differsFromShown).toBe(0);
    expect(checkWebsiteOrderTotals({ ...base, total: 1142.42, shownTotal: 2302.42 })).toMatchObject({
      shownTotal: 2302.42,
      differsFromShown: -1160,
    });
  });
});
