import { describe, expect, it } from "vitest";
import {
  deliveryTypeAfterSelectingType,
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

  it("TV has 7 mutually-exclusive mount/size type options: wall and TV bench in 3 sizes, stand for 75\"-100\"", () => {
    const tv = WHITE_GOODS_ELECTRONICS_PRODUCTS.find((p) => p.code === "WG_TV")!;
    const types = typeOptions(tv) as Array<(typeof tv.options)[number] & { typeEn?: string; size?: string }>;
    expect(types).toHaveLength(7);
    expect(types.map((o) => `${o.typeEn} ${o.size}`)).toEqual([
      'Wall mount Under 55"',
      'Wall mount 55"–74"',
      'Wall mount 75"–100"',
      'On TV bench / table Under 55"',
      'On TV bench / table 55"–74"',
      'On TV bench / table 75"–100"',
      'On a stand 75"–100"',
    ]);
  });

  it("prices the TV stand as table mounting 75\"-100\" plus the former stand / feet add-on", () => {
    const tv = WHITE_GOODS_ELECTRONICS_PRODUCTS.find((p) => p.code === "WG_TV")!;
    const stand = tv.options.find((o) => o.code === "TV_MOUNT_STAND_75_100")!;
    expect(stand.customerPrice).toBeCloseTo(514.968 + 1546.968, 3);
    expect(stand.subcontractorPrice).toBeCloseTo(236.328 + 772.968, 3);
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

  it("Cooker's plug fitting is a standalone type choice, exclusive with the two install types", () => {
    const cooker = WHITE_GOODS_ELECTRONICS_PRODUCTS.find((p) => p.code === "WG_COOKER")!;
    const plug = cooker.options.find((o) => o.code === "COOKER_INSTALL_PLUG")!;

    expect(plug.exclusiveGroup).toBe("type");
    expect(plug.standaloneInstall).toBe(true);
    expect(plug.customerPrice).toBeCloseTo(308.568, 3);
    expect(typeOptions(cooker).map((o) => o.code)).toEqual([
      "COOKER_CABLE_FIT",
      "COOKER_INCL_PLUG",
      "COOKER_INSTALL_PLUG",
    ]);
  });

  it("deliveryTypeAfterSelectingType keeps the chosen delivery for standalone options, otherwise implies carry-in", () => {
    const cooker = WHITE_GOODS_ELECTRONICS_PRODUCTS.find((p) => p.code === "WG_COOKER")!;
    const plug = cooker.options.find((o) => o.code === "COOKER_INSTALL_PLUG")!;
    const cable = cooker.options.find((o) => o.code === "COOKER_CABLE_FIT")!;

    // Plug only: the cooker is delivered but not installed, so delivery is untouched.
    expect(deliveryTypeAfterSelectingType(plug, "FIRST_STEP")).toBe("FIRST_STEP");
    expect(deliveryTypeAfterSelectingType(plug, "INDOOR")).toBe("INDOOR");
    expect(deliveryTypeAfterSelectingType(plug, "INSTALL_ONLY")).toBe("INSTALL_ONLY");
    expect(deliveryTypeAfterSelectingType(plug, "")).toBe("");

    // Installing the cooker implies carry-in, except for installation only.
    expect(deliveryTypeAfterSelectingType(cable, "FIRST_STEP")).toBe("INDOOR");
    expect(deliveryTypeAfterSelectingType(cable, "")).toBe("INDOOR");
    expect(deliveryTypeAfterSelectingType(cable, "INSTALL_ONLY")).toBe("INSTALL_ONLY");
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

describe("wine cooler", () => {
  // Wine coolers are always integrated, so the size choice doesn't repeat
  // "integrated"; the front panel is one add-on under either size.
  it("labels the install sizes without 'integrated' and keeps one front-panel add-on", () => {
    const wineCooler = WHITE_GOODS_ELECTRONICS_PRODUCTS.find((p) => p.code === "WG_WINE_COOLER");
    const installs = wineCooler?.options.filter((o) => o.category === "install") ?? [];
    expect(installs.map((o) => [o.code, o.labelNo, o.labelEn])).toEqual([
      ["WINE_COOLER_SM_INT", "Montering av lite vinkjøleskap", "Install small wine cooler"],
      ["WINE_COOLER_LG_INT", "Montering av stort vinkjøleskap", "Install large wine cooler"],
      ["WINE_COOLER_INT_FP", "Montering av front", "Install front panel"],
    ]);
  });
});

describe("washer/dryer stacking", () => {
  function stackingOptions(code: string) {
    const product = WHITE_GOODS_ELECTRONICS_PRODUCTS.find((p) => p.code === code);
    if (!product) throw new Error(`missing ${code}`);
    return product.options
      .filter((option) => option.category === "install" && !option.exclusiveGroup)
      .map(({ code: _code, labelEn: _en, labelNo: _no, ...rest }) => rest);
  }

  it("offers the washing machine the same stack-on-top and stacking-frame installs as the tumble dryer", () => {
    const washer = WHITE_GOODS_ELECTRONICS_PRODUCTS.find((p) => p.code === "WG_WASHING_MACHINE");
    expect(washer?.options.map((o) => o.code)).toEqual(
      expect.arrayContaining(["WASHING_MACHINE_STACK_ON_DRYER", "WASHING_MACHINE_STACK_FRAME"]),
    );
    expect(stackingOptions("WG_WASHING_MACHINE")).toEqual(stackingOptions("WG_TUMBLE_DRYER"));
  });
});
