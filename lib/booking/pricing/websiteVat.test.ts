import { describe, expect, it } from "vitest";
import {
  websiteCustomerPrice,
  websiteCustomerTotalDisplay,
  websiteCustomerTotals,
  websiteInclVat,
} from "./websiteVat";

// Website price lists hold prices ex. VAT (like the booking app). A private
// customer sees and pays each line with 25% VAT added, rounded to whole
// kroner, and the total is the sum of those lines.
describe("websiteInclVat", () => {
  it("adds 25% VAT and rounds to whole kroner", () => {
    expect(websiteInclVat(364)).toBe(455);
    expect(websiteInclVat(365)).toBe(456);
    expect(websiteInclVat(37.5 * 61)).toBe(2859);
    expect(websiteInclVat(0)).toBe(0);
  });

  it("rounds a negative amount (a discount line) the same way as a positive one", () => {
    expect(websiteInclVat(-50)).toBe(-63);
    expect(websiteInclVat(50)).toBe(63);
  });
});

describe("websiteCustomerPrice", () => {
  it("shows a private customer the price incl. VAT, a business customer the price ex. VAT", () => {
    expect(websiteCustomerPrice(365, "private")).toBe(456);
    expect(websiteCustomerPrice(365, "business")).toBe(365);
  });
});

describe("websiteCustomerTotals", () => {
  const result = {
    breakdowns: [
      { lines: [{ lineTotal: 365 }, { lineTotal: 0 }] },
      { isOrderExtras: true, lines: [{ lineTotal: 1830 }, { lineTotal: 101 }] },
    ],
    totals: { totalExVat: 365 + 1830 + 101 - 50 + 10, discount: 50, extra: 10 },
  };

  it("sums each line incl. VAT (rounded per line), then takes off the discount and adds the extra incl. VAT", () => {
    // 456 + 0 + 2288 + 126 − 63 + 13
    expect(websiteCustomerTotals(result)).toEqual({ totalExVat: 2256, totalIncVat: 2820, vat: 564 });
  });

  it("is plain 25% on top when every line divides evenly", () => {
    const even = { breakdowns: [{ lines: [{ lineTotal: 364 }, { lineTotal: 208 }] }], totals: { totalExVat: 572, discount: 0, extra: 0 } };
    expect(websiteCustomerTotals(even)).toEqual({ totalExVat: 572, totalIncVat: 715, vat: 143 });
  });
});

describe("websiteCustomerTotalDisplay", () => {
  it("leads with the total incl. VAT for a private customer, ex. VAT for a business", () => {
    expect(websiteCustomerTotalDisplay({ totalExVat: 572, totalIncVat: 715, customerType: "private" })).toEqual({
      primary: "incVat",
      primaryAmount: 715,
      secondaryAmount: 572,
    });
    expect(websiteCustomerTotalDisplay({ totalExVat: 572, totalIncVat: 715, customerType: "business" })).toEqual({
      primary: "exVat",
      primaryAmount: 572,
      secondaryAmount: 715,
    });
  });
});
