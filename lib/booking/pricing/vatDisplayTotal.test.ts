import { describe, expect, it } from "vitest";
import { getVatBreakdown, getVatDisplayAmount, getVatDisplayTotal } from "./vatDisplayTotal";

// Catalog/line prices are entered and stored as what a private customer
// actually pays (VAT-inclusive) — the public flow never bothers a private
// customer with VAT math. Business customers reclaim VAT, so the same
// stored price is shown to them with VAT backed out (divided by 1.25).

describe("getVatDisplayAmount", () => {
  it("leaves the client price unchanged for private customers", () => {
    expect(getVatDisplayAmount(1250, "private")).toBe(1250);
  });

  it("backs VAT out of the client price for business customers", () => {
    expect(getVatDisplayAmount(1250, "business")).toBe(1000);
  });

  it("defaults to the private (unchanged) display when no customer type is given", () => {
    expect(getVatDisplayAmount(1250)).toBe(1250);
  });

  it("rounds to the nearest øre", () => {
    expect(getVatDisplayAmount(33.33, "business")).toBe(26.66);
  });
});

describe("getVatDisplayTotal", () => {
  it("shows the client total unchanged as primary, ex-VAT as secondary, for private customers", () => {
    const result = getVatDisplayTotal({ total: 1250, customerType: "private" });
    expect(result).toEqual({ primary: "incVat", primaryAmount: 1250, secondaryAmount: 1000 });
  });

  it("shows ex-VAT as primary and the client total as secondary for business customers", () => {
    const result = getVatDisplayTotal({ total: 1250, customerType: "business" });
    expect(result).toEqual({ primary: "exVat", primaryAmount: 1000, secondaryAmount: 1250 });
  });

  it("defaults to the private (client-total primary) display when no customer type is given", () => {
    const result = getVatDisplayTotal({ total: 1250 });
    expect(result.primary).toBe("incVat");
  });

  it("is consistent with getVatDisplayAmount for the same total", () => {
    expect(getVatDisplayTotal({ total: 1250, customerType: "business" }).primaryAmount).toBe(
      getVatDisplayAmount(1250, "business"),
    );
  });
});

describe("getVatBreakdown", () => {
  it("splits a client (VAT-inclusive) total into ex-VAT / VAT / incl-VAT", () => {
    expect(getVatBreakdown(1250)).toEqual({ exVat: 1000, vat: 250, incVat: 1250 });
  });

  it("rounds ex-VAT and VAT to the nearest øre", () => {
    expect(getVatBreakdown(333)).toEqual({ exVat: 266.4, vat: 66.6, incVat: 333 });
  });
});
