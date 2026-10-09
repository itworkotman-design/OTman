import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { getCalculatorProductName, getSummaryProductTitle } from "./productDisplayName";

function product(code: string, sizePriced: boolean) {
  return {
    id: code,
    code,
    options: sizePriced ? [{ id: "v", code: "OF_VOL_1", category: "size_volume", active: true, customerPrice: "0" }] : [],
  } as unknown as CatalogProduct;
}

describe("getCalculatorProductName", () => {
  it("titles Other furniture with the customer's own name, prefixed A.M (Andre møbler)", () => {
    expect(getCalculatorProductName({ product: product("FN_OTHER_FURNITURE", true), itemName: "Fish", label: "Other furniture" })).toBe(
      "A.M: Fish",
    );
  });

  it("trims the name", () => {
    expect(getCalculatorProductName({ product: product("FN_OTHER_FURNITURE", true), itemName: "  Fish  ", label: "Other furniture" })).toBe(
      "A.M: Fish",
    );
  });

  it("falls back to the normal product label until a name is typed", () => {
    for (const itemName of ["", "   ", undefined]) {
      expect(getCalculatorProductName({ product: product("FN_OTHER_FURNITURE", true), itemName, label: "Other furniture" })).toBe(
        "Other furniture",
      );
    }
  });

  it("never renames ordinary products, even if a model number is set", () => {
    expect(getCalculatorProductName({ product: product("WG_WASHING_MACHINE", false), itemName: "WM-500", label: "Washing machine" })).toBe(
      "Washing machine",
    );
  });

  it("uses the label as the prefix for any other size-priced product", () => {
    expect(getCalculatorProductName({ product: product("FN_SOMETHING_ELSE", true), itemName: "Fish", label: "Something else" })).toBe(
      "Something else: Fish",
    );
  });
});

describe("getSummaryProductTitle", () => {
  it("titles Other furniture with the customer's own name and keeps the category as a subtitle", () => {
    expect(getSummaryProductTitle({ product: product("FN_OTHER_FURNITURE", true), itemName: "  Piano stool ", label: "Andre møbler" })).toEqual({
      name: "Piano stool",
      subtitle: "Andre møbler",
    });
  });

  it("uses the plain label (no subtitle) until a name is typed", () => {
    expect(getSummaryProductTitle({ product: product("FN_OTHER_FURNITURE", true), itemName: " ", label: "Andre møbler" })).toEqual({
      name: "Andre møbler",
      subtitle: null,
    });
  });

  it("never renames ordinary products", () => {
    expect(getSummaryProductTitle({ product: product("WG_WASHING_MACHINE", false), itemName: "WM-500", label: "Vaskemaskin" })).toEqual({
      name: "Vaskemaskin",
      subtitle: null,
    });
  });
});
