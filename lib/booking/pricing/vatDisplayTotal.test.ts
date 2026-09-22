import { describe, expect, it } from "vitest";
import { getVatDisplayTotal } from "./vatDisplayTotal";

describe("getVatDisplayTotal", () => {
  it("shows incl.-VAT as primary and ex-VAT as secondary for private customers", () => {
    const result = getVatDisplayTotal({ totalExVat: 1000, totalIncVat: 1250, customerType: "private" });
    expect(result).toEqual({ primary: "incVat", primaryAmount: 1250, secondaryAmount: 1000 });
  });

  it("shows ex-VAT as primary and incl.-VAT as secondary for business customers", () => {
    const result = getVatDisplayTotal({ totalExVat: 1000, totalIncVat: 1250, customerType: "business" });
    expect(result).toEqual({ primary: "exVat", primaryAmount: 1000, secondaryAmount: 1250 });
  });

  it("defaults to the private (incl.-VAT primary) display when no customer type is given", () => {
    const result = getVatDisplayTotal({ totalExVat: 1000, totalIncVat: 1250 });
    expect(result.primary).toBe("incVat");
  });
});
