import { describe, expect, it } from "vitest";
import { findUnsellableProductIds, mergeWebsiteCatalogs, type WebsiteCatalogPart } from "./mergeWebsiteCatalogs";
import { createDefaultPriceListSettings } from "@/lib/products/priceListSettings";
import type { CatalogProduct, CatalogSpecialOption } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

const product = (id: string) => ({ id, code: `C_${id}`, label: id }) as unknown as CatalogProduct;
const special = (id: string) => ({ id }) as unknown as CatalogSpecialOption;

function part(priceListId: string, productIds: string[], specialIds: string[] = []): WebsiteCatalogPart {
  const settings = createDefaultPriceListSettings();
  settings.floorSurcharge = { ...settings.floorSurcharge, price: priceListId };
  return {
    priceListId,
    products: productIds.map(product),
    specialOptions: specialIds.map(special),
    priceListSettings: settings,
  };
}

describe("mergeWebsiteCatalogs", () => {
  it("concatenates products in list order into one catalog", () => {
    const merged = mergeWebsiteCatalogs([part("wg", ["a", "b"]), part("fn", ["c"])]);
    expect(merged.products.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("takes the price list id, special options and order-level fees from the FIRST list", () => {
    const merged = mergeWebsiteCatalogs([part("wg", ["a"], ["x1"]), part("fn", ["c"], ["x2"])]);
    expect(merged.priceListId).toBe("wg");
    expect(merged.specialOptions.map((o) => o.id)).toEqual(["x1"]);
    expect(merged.priceListSettings.floorSurcharge.price).toBe("wg");
  });

  it("lists every price list that contributed", () => {
    expect(mergeWebsiteCatalogs([part("wg", []), part("fn", [])]).priceListIds).toEqual(["wg", "fn"]);
  });

  it("throws on an empty list, since there is no first catalog to take the fees from", () => {
    expect(() => mergeWebsiteCatalogs([])).toThrow();
  });

  it("throws if two lists contain the same product id", () => {
    expect(() => mergeWebsiteCatalogs([part("wg", ["a"]), part("fn", ["a"])])).toThrow(/a/);
  });
});

describe("findUnsellableProductIds", () => {
  const catalog = [product("a"), product("b")];

  it("returns the card product ids that aren't in the website catalog", () => {
    expect(
      findUnsellableProductIds(
        [{ productId: "a" }, { productId: "dashboard-only" }, { productId: "b" }, { productId: "x" }],
        catalog,
      ),
    ).toEqual(["dashboard-only", "x"]);
  });

  it("treats a card with no product as unsellable, and returns [] when everything is in the catalog", () => {
    expect(findUnsellableProductIds([{ productId: null }], catalog)).toEqual([""]);
    expect(findUnsellableProductIds([{ productId: "a" }], catalog)).toEqual([]);
  });
});
