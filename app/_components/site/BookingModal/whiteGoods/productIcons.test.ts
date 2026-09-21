import { describe, expect, it } from "vitest";
import { hasProductIcon } from "./productIcons";
import { FURNITURE_PRODUCTS } from "@/lib/content/furnitureCatalog";
import { WHITE_GOODS_ELECTRONICS_PRODUCTS } from "@/lib/content/whiteGoodsElectronics";

// A product without its own icon silently renders the generic placeholder, so
// pin that every website product has one.
describe("product icons", () => {
  it("has a dedicated icon for every furniture product", () => {
    const missing = FURNITURE_PRODUCTS.filter((p) => !hasProductIcon(p.code, p.iconKey)).map((p) => p.code);
    expect(missing).toEqual([]);
  });

  it("still has a dedicated icon for every white-goods product", () => {
    const missing = WHITE_GOODS_ELECTRONICS_PRODUCTS.filter((p) => !hasProductIcon(p.code, p.iconKey)).map((p) => p.code);
    expect(missing).toEqual([]);
  });

  it("reports no icon for an unknown product", () => {
    expect(hasProductIcon("FN_NOT_A_THING")).toBe(false);
  });
});
