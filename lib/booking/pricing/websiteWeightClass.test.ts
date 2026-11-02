import { describe, expect, it } from "vitest";
import {
  applyWebsiteWeightClassReturnOrderItems,
  applyWebsiteWeightClassReturnPrices,
  cardWeightClass,
  orderWeightClass,
  websiteFloorSurchargeSetting,
  websiteReturnDisplayPrice,
} from "./websiteWeightClass";
import { createDefaultProductAutoDeliveryPrice } from "@/lib/products/autoDeliveryPrice";
import { createDefaultProductDeliveryTypes } from "@/lib/products/deliveryTypes";
import {
  createDefaultPriceListSettings,
  createDefaultWeightClassPricing,
  type PriceListSettings,
} from "@/lib/products/priceListSettings";
import type { BuiltOrderItem } from "@/lib/orders/buildOrderItemsFromCards";
import type { ProductBreakdown } from "./types";
import {
  createEmptyProductCard,
  type CatalogOption,
  type CatalogProduct,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// Website weight classes: the no-lift floor surcharge is priced by the
// order's heaviest item, the return by each item's own class; a product
// without a class counts as LIGHT, and a picked assembly type with its own
// class (Outdoor chair / Lounge set) overrides the product's.

function option(id: string, category: string, extra: Partial<CatalogOption> = {}): CatalogOption {
  return {
    id,
    code: id.toUpperCase(),
    label: id,
    description: null,
    category,
    customerPrice: "258",
    subcontractorPrice: "155",
    effectiveCustomerPrice: "258",
    active: true,
    ...extra,
  };
}

function product(id: string, overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id,
    code: id.toUpperCase(),
    label: id,
    active: true,
    productType: "PHYSICAL",
    allowDeliveryTypes: true,
    allowInstallOptions: true,
    allowReturnOptions: true,
    allowExtraServices: true,
    allowDemont: true,
    allowQuantity: true,
    allowPeopleCount: false,
    allowHoursInput: false,
    allowModelNumber: true,
    autoXtraPerPallet: false,
    autoDeliveryPrice: createDefaultProductAutoDeliveryPrice(),
    deliveryTypes: createDefaultProductDeliveryTypes(),
    customSections: [],
    options: [option(`${id}-return`, "return")],
    ...overrides,
  };
}

function card(cardId: number, productId: string, patch: Partial<SavedProductCard> = {}): SavedProductCard {
  return { ...createEmptyProductCard(cardId), productId, deliveryType: "FIRST_STEP", ...patch };
}

const charge = (code: string, price: string, subcontractorPrice: string) => ({ code, description: code, price, subcontractorPrice });

function settingsWithWeightClasses(): PriceListSettings {
  const pricing = createDefaultWeightClassPricing();
  pricing.floorSurcharge = {
    LIGHT: charge("FLOOR_SURCHARGE_LIGHT", "32", "10"),
    MEDIUM: charge("FLOOR_SURCHARGE_MEDIUM", "56", "20"),
    HEAVY: charge("FLOOR_SURCHARGE_HEAVY", "80", "30"),
  };
  pricing.returnPrice = {
    LIGHT: charge("RETURN_LIGHT", "80", "45"),
    MEDIUM: charge("RETURN_MEDIUM", "152", "90"),
    HEAVY: charge("RETURN_HEAVY", "304", "180"),
  };
  return { ...createDefaultPriceListSettings(), weightClassPricing: pricing };
}

const outdoor = product("outdoor", {
  weightClass: "MEDIUM",
  options: [
    option("outdoor-return", "return"),
    option("outdoor-chair", "install", { weightClass: "LIGHT" }),
    option("outdoor-lounge", "install", { weightClass: "HEAVY" }),
  ],
});
const sofa = product("sofa", { weightClass: "HEAVY" });
const toaster = product("toaster");

describe("cardWeightClass", () => {
  it("uses the product's class, and LIGHT for a product without one", () => {
    expect(cardWeightClass(card(0, "sofa"), sofa)).toBe("HEAVY");
    expect(cardWeightClass(card(0, "toaster"), toaster)).toBe("LIGHT");
  });

  it("lets a picked assembly type with its own class override the product's", () => {
    expect(cardWeightClass(card(0, "outdoor"), outdoor)).toBe("MEDIUM");
    expect(cardWeightClass(card(0, "outdoor", { selectedInstallOptionIds: ["outdoor-chair"] }), outdoor)).toBe("LIGHT");
    expect(cardWeightClass(card(0, "outdoor", { selectedInstallOptionIds: ["outdoor-lounge"] }), outdoor)).toBe("HEAVY");
  });
});

describe("orderWeightClass", () => {
  it("takes the heaviest item in the order, LIGHT for an empty order", () => {
    const products = [sofa, toaster, outdoor];
    expect(orderWeightClass([card(0, "toaster"), card(1, "outdoor")], products)).toBe("MEDIUM");
    expect(orderWeightClass([card(0, "toaster"), card(1, "sofa")], products)).toBe("HEAVY");
    expect(orderWeightClass([], products)).toBe("LIGHT");
  });
});

describe("websiteFloorSurchargeSetting", () => {
  it("prices the floor surcharge by the order's heaviest class", () => {
    const setting = websiteFloorSurchargeSetting(settingsWithWeightClasses(), [card(0, "toaster"), card(1, "sofa")], [sofa, toaster]);
    expect(setting).toMatchObject({ code: "FLOOR_SURCHARGE_HEAVY", price: "80", subcontractorPrice: "30" });
  });

  it("keeps the flat floor surcharge on a list without weight class pricing", () => {
    const settings = { ...createDefaultPriceListSettings(), floorSurcharge: charge("FLOOR_SURCHARGE", "72", "30") };
    expect(websiteFloorSurchargeSetting(settings, [card(0, "sofa")], [sofa])).toMatchObject({ code: "FLOOR_SURCHARGE", price: "72" });
  });
});

describe("applyWebsiteWeightClassReturnPrices", () => {
  const breakdown = (cardId: number, items: ProductBreakdown["items"]): ProductBreakdown => ({ productName: "x", cardId, items });

  it("prices each card's return option at its own class's return price, customer and partner", () => {
    const cards = [card(0, "sofa"), card(1, "toaster")];
    const result = applyWebsiteWeightClassReturnPrices(
      [
        breakdown(0, [{ kind: "productOption", productOptionId: "sofa-return", qty: 2 }]),
        breakdown(1, [{ kind: "productOption", productOptionId: "toaster-return", qty: 1 }]),
      ],
      cards,
      [sofa, toaster],
      settingsWithWeightClasses(),
    );
    expect(result[0].items[0]).toMatchObject({ qty: 2, priceOverride: 304, subcontractorPriceOverride: 180 });
    expect(result[1].items[0]).toMatchObject({ priceOverride: 80, subcontractorPriceOverride: 45 });
  });

  it("leaves non-return options and an already overridden return (return-only's 0) alone", () => {
    const result = applyWebsiteWeightClassReturnPrices(
      [
        breakdown(0, [
          { kind: "productOption", productOptionId: "outdoor-chair", qty: 1 },
          { kind: "productOption", productOptionId: "outdoor-return", qty: 1, priceOverride: 0, subcontractorPriceOverride: 0 },
        ]),
      ],
      [card(0, "outdoor")],
      [outdoor],
      settingsWithWeightClasses(),
    );
    expect(result[0].items[0]).not.toHaveProperty("priceOverride");
    expect(result[0].items[1]).toMatchObject({ priceOverride: 0, subcontractorPriceOverride: 0 });
  });

  it("changes nothing on a list without weight class pricing", () => {
    const breakdowns = [breakdown(0, [{ kind: "productOption" as const, productOptionId: "sofa-return", qty: 1 }])];
    expect(applyWebsiteWeightClassReturnPrices(breakdowns, [card(0, "sofa")], [sofa], createDefaultPriceListSettings())).toBe(breakdowns);
  });
});

describe("applyWebsiteWeightClassReturnOrderItems", () => {
  const returnItem = (cardId: number, productId: string, optionId: string): BuiltOrderItem => ({
    cardId,
    productId,
    productCode: productId.toUpperCase(),
    productName: productId,
    deliveryType: "Delivery to doorstep",
    itemType: "RETURN_OPTION",
    optionId,
    optionCode: optionId.toUpperCase(),
    optionLabel: optionId,
    quantity: 1,
    customerPriceCents: 25800,
    subcontractorPriceCents: 15500,
  });

  it("stores the class price on the saved return line, so the lines add up to the priced total", () => {
    const [item] = applyWebsiteWeightClassReturnOrderItems([returnItem(0, "sofa", "sofa-return")], [card(0, "sofa")], [sofa], settingsWithWeightClasses());
    expect(item).toMatchObject({ customerPriceCents: 30400, subcontractorPriceCents: 18000 });
  });

  it("keeps a return line an admin set to 0 at 0", () => {
    const nulled = card(0, "sofa", { nulledLineKeysForCustomer: ["opt:sofa-return"] });
    const [item] = applyWebsiteWeightClassReturnOrderItems([returnItem(0, "sofa", "sofa-return")], [nulled], [sofa], settingsWithWeightClasses());
    expect(item.customerPriceCents).toBe(0);
    expect(item.subcontractorPriceCents).toBe(18000);
  });
});

describe("each item priced by its own list's weight class prices", () => {
  // White goods: light is 80 floor / 264 return; furniture keeps the table (light 32 / 80).
  const whiteGoodsPricing = (() => {
    const pricing = settingsWithWeightClasses().weightClassPricing!;
    return {
      ...pricing,
      floorSurcharge: { ...pricing.floorSurcharge, LIGHT: charge("FLOOR_SURCHARGE_LIGHT", "80", "30") },
      returnPrice: { ...pricing.returnPrice, LIGHT: charge("RETURN_LIGHT", "264", "155") },
    };
  })();
  const fridge = product("fridge", { weightClass: null, weightClassPricing: whiteGoodsPricing });
  const chair = product("chair", { weightClass: "LIGHT", weightClassPricing: settingsWithWeightClasses().weightClassPricing });
  const table = product("table", { weightClass: "MEDIUM", weightClassPricing: settingsWithWeightClasses().weightClassPricing });

  it("prices a return at the item's own list's class price", () => {
    const result = applyWebsiteWeightClassReturnPrices(
      [
        { productName: "x", cardId: 0, items: [{ kind: "productOption", productOptionId: "fridge-return", qty: 1 }] },
        { productName: "x", cardId: 1, items: [{ kind: "productOption", productOptionId: "chair-return", qty: 1 }] },
      ],
      [card(0, "fridge"), card(1, "chair")],
      [fridge, chair],
      settingsWithWeightClasses(),
    );
    expect(result[0].items[0]).toMatchObject({ priceOverride: 264, subcontractorPriceOverride: 155 });
    expect(result[1].items[0]).toMatchObject({ priceOverride: 80, subcontractorPriceOverride: 45 });
  });

  it("charges the floors at the highest rate among the items, each at its own class and list", () => {
    const products = [fridge, chair, table];
    const settings = settingsWithWeightClasses();
    expect(websiteFloorSurchargeSetting(settings, [card(0, "chair")], products).price).toBe("32");
    // A light fridge (80) outweighs a medium furniture table (56) — adding the table never lowers it.
    expect(websiteFloorSurchargeSetting(settings, [card(0, "fridge"), card(1, "table")], products)).toMatchObject({ price: "80", subcontractorPrice: "30" });
    expect(websiteFloorSurchargeSetting(settings, [card(0, "chair"), card(1, "table")], products).price).toBe("56");
  });
});

describe("websiteReturnDisplayPrice", () => {
  // What the card shows on its return row: the same class price the order is charged.
  const pricing = settingsWithWeightClasses().weightClassPricing;

  it("shows the item class return price from its list", () => {
    const priced = { ...sofa, weightClassPricing: pricing };
    expect(websiteReturnDisplayPrice(card(0, "sofa"), priced, priced.options[0])).toBe("304");
  });

  it("follows a picked assembly type class", () => {
    const priced = { ...outdoor, weightClassPricing: pricing };
    const returnOption = priced.options[0];
    expect(websiteReturnDisplayPrice(card(0, "outdoor"), priced, returnOption)).toBe("152");
    expect(websiteReturnDisplayPrice(card(0, "outdoor", { selectedInstallOptionIds: ["outdoor-chair"] }), priced, returnOption)).toBe("80");
  });

  it("keeps the option own price without weight class pricing", () => {
    expect(websiteReturnDisplayPrice(card(0, "sofa"), sofa, sofa.options[0])).toBe("258");
  });
});
