import { describe, expect, it } from "vitest";
import {
  WHITE_GOODS_ELECTRONICS_PRODUCTS,
  type WhiteGoodsProductSeed,
} from "./whiteGoodsElectronics";

function typeOptions(product: WhiteGoodsProductSeed) {
  return product.options.filter((option) => option.exclusiveGroup === "type");
}

describe("WHITE_GOODS_ELECTRONICS_PRODUCTS", () => {
  it("has exactly 15 products with unique codes", () => {
    expect(WHITE_GOODS_ELECTRONICS_PRODUCTS).toHaveLength(15);

    const codes = WHITE_GOODS_ELECTRONICS_PRODUCTS.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("uses a distinct WG_ code namespace, never colliding with the existing dashboard products", () => {
    // Product.deliveryTypes is a Product-level column, not price-list-scoped —
    // reusing the dashboard's "DISHWASHER"/"WASHING_MACHINE" codes here would
    // change pricing for the internal booking flow too.
    for (const product of WHITE_GOODS_ELECTRONICS_PRODUCTS) {
      expect(product.code.startsWith("WG_")).toBe(true);
      expect(product.code).not.toBe("DISHWASHER");
      expect(product.code).not.toBe("WASHING_MACHINE");
    }
  });

  it("has unique option codes within each product", () => {
    for (const product of WHITE_GOODS_ELECTRONICS_PRODUCTS) {
      const codes = product.options.map((o) => o.code);
      expect(new Set(codes).size, `${product.code} has duplicate option codes`).toBe(
        codes.length,
      );
    }
  });

  it("gives every product Unpacking, Dismantling, and a Return option", () => {
    for (const product of WHITE_GOODS_ELECTRONICS_PRODUCTS) {
      const codes = product.options.map((o) => o.code);
      expect(codes, product.code).toContain("UNPACKING");
      expect(codes, product.code).toContain("DEMONT");
      expect(
        product.options.some((o) => o.category === "return"),
        `${product.code} is missing a return option`,
      ).toBe(true);
    }
  });

  it("prices Unpacking/Dismantling identically across every product", () => {
    for (const product of WHITE_GOODS_ELECTRONICS_PRODUCTS) {
      const unpacking = product.options.find((o) => o.code === "UNPACKING")!;
      const demont = product.options.find((o) => o.code === "DEMONT")!;

      expect(unpacking).toEqual(
        expect.objectContaining({ customerPrice: 103.2, subcontractorPrice: 51.6 }),
      );
      expect(demont).toEqual(
        expect.objectContaining({ customerPrice: 205.368, subcontractorPrice: 102.168 }),
      );
    }
  });

  it("prices the return option at 258/154.8, except Side-by-side refrigerator at 464.4/258", () => {
    for (const product of WHITE_GOODS_ELECTRONICS_PRODUCTS) {
      const returnOption = product.options.find((o) => o.category === "return")!;
      const expected =
        product.code === "WG_SIDE_BY_SIDE_FRIDGE"
          ? { customerPrice: 464.4, subcontractorPrice: 258 }
          : { customerPrice: 258, subcontractorPrice: 154.8 };

      expect(returnOption, product.code).toEqual(expect.objectContaining(expected));
    }
  });

  it("Chest freezer has installOnlyEnabled=false and no install-type options", () => {
    const chestFreezer = WHITE_GOODS_ELECTRONICS_PRODUCTS.find(
      (p) => p.code === "WG_CHEST_FREEZER",
    )!;

    expect(chestFreezer.deliveryTypes.installOnlyEnabled).toBe(false);
    expect(typeOptions(chestFreezer)).toHaveLength(0);
  });

  it("every other product has at least one mutually-exclusive install type option", () => {
    for (const product of WHITE_GOODS_ELECTRONICS_PRODUCTS) {
      if (product.code === "WG_CHEST_FREEZER") continue;

      expect(typeOptions(product).length, product.code).toBeGreaterThan(0);
      expect(product.deliveryTypes.installOnlyEnabled, product.code).toBe(true);
    }
  });

  it("TV has exactly 6 mutually-exclusive mount/size type options", () => {
    const tv = WHITE_GOODS_ELECTRONICS_PRODUCTS.find((p) => p.code === "WG_TV")!;
    expect(typeOptions(tv)).toHaveLength(6);
  });

  it("every type option's install-only price satisfies the additive-pricing identity", () => {
    // installOnlyPrice === combinedDeliveryPlusInstallPrice - indoorCarryInBasePrice
    for (const product of WHITE_GOODS_ELECTRONICS_PRODUCTS) {
      const indoor = product.deliveryTypes.indoor;

      for (const option of typeOptions(product)) {
        if (!option.combinedWithIndoorInstall) continue;

        const expectedCustomer =
          option.combinedWithIndoorInstall.customerPrice - indoor.customerPrice;
        const expectedSubcontractor =
          option.combinedWithIndoorInstall.subcontractorPrice - indoor.subcontractorPrice;

        expect(
          option.customerPrice,
          `${product.code}/${option.code} customer price`,
        ).toBeCloseTo(expectedCustomer, 3);
        expect(
          option.subcontractorPrice,
          `${product.code}/${option.code} subcontractor price`,
        ).toBeCloseTo(expectedSubcontractor, 3);
      }
    }
  });

  it("gives doorstep and carry-in distinct 'xtra' (2nd+ item) delivery prices, doorstep cheaper", () => {
    // Source: "Otman_booking_upper_level_tree_v1_1.xlsx", "Rules & pricing" sheet,
    // "Additional delivery item" row — doorstep (XTRALEVERING) 154.80/103.20,
    // carry-in (XTRAINB) 236.33/123.84. These must never collapse to the same
    // flat rate for both delivery types.
    for (const product of WHITE_GOODS_ELECTRONICS_PRODUCTS) {
      const { firstStep, indoor } = product.deliveryTypes;

      expect(firstStep.xtraPrice, `${product.code} firstStep.xtraPrice`).toBeCloseTo(154.8, 3);
      expect(firstStep.xtraSubcontractorPrice, `${product.code} firstStep.xtraSubcontractorPrice`).toBeCloseTo(103.2, 3);
      expect(indoor.xtraPrice, `${product.code} indoor.xtraPrice`).toBeCloseTo(236.33, 3);
      expect(indoor.xtraSubcontractorPrice, `${product.code} indoor.xtraSubcontractorPrice`).toBeCloseTo(123.84, 3);

      expect(firstStep.xtraPrice, product.code).toBeLessThan(indoor.xtraPrice);
    }
  });

  it("no option has a negative price", () => {
    for (const product of WHITE_GOODS_ELECTRONICS_PRODUCTS) {
      for (const option of product.options) {
        expect(option.customerPrice, `${product.code}/${option.code}`).toBeGreaterThanOrEqual(0);
        expect(
          option.subcontractorPrice,
          `${product.code}/${option.code}`,
        ).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
