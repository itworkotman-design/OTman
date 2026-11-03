import { describe, expect, it } from "vitest";
import {
  createEmptyProductCard,
  type CatalogProduct,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { normalizePriceListSettings } from "@/lib/products/priceListSettings";
import { buildWebsiteOrderItems, priceWebsiteOrder, type WebsiteOrderPricingInput } from "./priceWebsiteOrder";
import { CUSTOM_DEVIATION_CODE, DEVIATION_FEE_OPTIONS } from "./deviationFees";

const deliveryType = (key: string, price: string, label: string) => ({
  key: key as CatalogProduct["deliveryTypes"][number]["key"],
  enabled: true,
  code: key,
  label,
  price,
  subcontractorPrice: "100",
  xtraPrice: "235",
  xtraSubcontractorPrice: "50",
  allowInstallOptions: true,
  allowExtraServices: true,
  allowReturnOptions: true,
  allowModelNumber: false,
});

const washer: CatalogProduct = {
  id: "p-wm",
  code: "WG_WASHING_MACHINE",
  label: "Washing machine",
  active: true,
  productType: "PHYSICAL",
  allowDeliveryTypes: true,
  allowInstallOptions: true,
  allowReturnOptions: true,
  allowExtraServices: true,
  allowDemont: false,
  allowQuantity: true,
  allowPeopleCount: false,
  allowHoursInput: false,
  allowModelNumber: false,
  autoXtraPerPallet: false,
  deliveryTypes: [
    deliveryType(DELIVERY_TYPES.FIRST_STEP, "450", "Doorstep"),
    deliveryType(DELIVERY_TYPES.INDOOR, "690", "Delivery with carry-in"),
  ],
  customSections: [],
  options: [
    {
      id: "inst-1",
      code: "WASHING_MACHINE_APPROVED_WETROOM",
      label: "Install – approved wet room",
      description: "",
      category: "install",
      customerPrice: "610",
      subcontractorPrice: "400",
      effectiveCustomerPrice: "610",
      active: true,
    },
    {
      id: "ret-1",
      code: "RETURN_RECYCLING",
      label: "Retur av gammel vare til gjenvinning",
      description: "",
      category: "return",
      customerPrice: "260",
      subcontractorPrice: "120",
      effectiveCustomerPrice: "260",
      active: true,
    },
  ],
};

const card = (cardId: number, overrides: Partial<SavedProductCard> = {}): SavedProductCard => ({
  ...createEmptyProductCard(cardId),
  productId: "p-wm",
  amount: 1,
  deliveryType: DELIVERY_TYPES.INDOOR,
  selectedInstallOptionIds: ["inst-1"],
  selectedReturnOptionId: "ret-1",
  ...overrides,
});

function input(drivingDistance: string, cards = [card(0), card(1, { selectedInstallOptionIds: [] })]): WebsiteOrderPricingInput {
  return {
    cards,
    catalogProducts: [washer],
    catalogSpecialOptions: [],
    priceListSettings: normalizePriceListSettings(null),
    drivingDistance,
    expressDelivery: false,
    extraPickups: [],
    pickupFloor: 0,
    deliveryFloor: 3,
    pickupLiftAvailable: true,
    deliveryLiftAvailable: false,
    extraPickupFloors: [],
  };
}

// What the admin sees (stored order lines + order extras) must add up to the
// total the customer was shown and charged.
function linesTotal(i: WebsiteOrderPricingInput) {
  const items = buildWebsiteOrderItems(i.cards, i.catalogProducts, i.catalogSpecialOptions, {
    drivingDistance: i.drivingDistance,
  });
  const lines = items.reduce((sum, item) => sum + (item.customerPriceCents ?? 0), 0) / 100;
  const { orderExtras } = priceWebsiteOrder(i);
  return lines + orderExtras.reduce((sum, extra) => sum + extra.price, 0);
}

describe("priceWebsiteOrder", () => {
  // Website prices are ex. VAT; what the customer pays is each line incl. VAT
  // rounded to whole kroner, summed (lib/booking/pricing/websiteVat.ts).
  it("gives the customer's totals: ex. VAT as priced, incl. VAT summed per line", () => {
    const { result, customerTotals } = priceWebsiteOrder(input("21"));
    const perLine = result.breakdowns.flatMap((b) => b.lines).reduce((sum, l) => sum + Math.round(l.lineTotal * 1.25), 0);
    expect(customerTotals.totalExVat).toBe(result.totals.totalExVat);
    expect(customerTotals.totalIncVat).toBe(perLine);
    expect(customerTotals.vat).toBe(customerTotals.totalIncVat - customerTotals.totalExVat);
  });

  it("charges base delivery within 100 km (the second item at the extra-item rate)", () => {
    const { result } = priceWebsiteOrder(input("21"));
    const deliveryLines = result.breakdowns.flatMap((b) => b.lines).filter((l) => l.label === "Delivery with carry-in");
    expect(deliveryLines.map((l) => l.lineTotal)).toEqual([690, 235]);
  });

  it("drops base delivery over 100 km (the per-km charge replaces it)", () => {
    const { result } = priceWebsiteOrder(input("171.12"));
    const deliveryLines = result.breakdowns.flatMap((b) => b.lines).filter((l) => l.label === "Delivery with carry-in");
    expect(deliveryLines.every((l) => l.lineTotal === 0)).toBe(true);
  });

  it("the stored order lines add up to the total, within and over 100 km, returns included", () => {
    for (const distance of ["21", "171.12"]) {
      const i = input(distance);
      const total = priceWebsiteOrder(i).result.totals.totalExVat;
      expect(linesTotal(i)).toBeCloseTo(total, 2);
    }
  });

  it("stores the return as a priced line", () => {
    const items = buildWebsiteOrderItems([card(0)], [washer], [], { drivingDistance: "21" });
    expect(items).toEqual(
      expect.arrayContaining([expect.objectContaining({ itemType: "RETURN_OPTION", customerPriceCents: 26000 })]),
    );
  });

  it("charges a deviation set by an admin, as an order extra (so the lines still add up)", () => {
    const notHome = DEVIATION_FEE_OPTIONS.find((o) => o.code === "NOTHOME")!;
    const i = { ...input("21"), deviation: { label: notHome.englishLabel } };
    const { result, orderExtras } = priceWebsiteOrder(i);
    const expected = Number(i.priceListSettings.deviations[notHome.code]?.price ?? notHome.price);
    expect(orderExtras).toEqual(expect.arrayContaining([{ label: notHome.englishLabel, price: expected, qty: 1 }]));
    expect(result.totals.totalExVat - priceWebsiteOrder(input("21")).result.totals.totalExVat).toBeCloseTo(expected, 2);
    expect(linesTotal(i)).toBeCloseTo(result.totals.totalExVat, 2);
  });

  it("uses the admin's own price and description for a custom deviation", () => {
    const custom = DEVIATION_FEE_OPTIONS.find((o) => o.code === CUSTOM_DEVIATION_CODE)!;
    const { orderExtras } = priceWebsiteOrder({
      ...input("21"),
      deviation: { label: custom.englishLabel, customPrice: 400, customSubcontractorPrice: 200, customDescription: "Ventetid 1 time" },
    });
    expect(orderExtras).toEqual(expect.arrayContaining([{ label: "Ventetid 1 time", price: 400, qty: 1 }]));
  });
});

// The booking app's "Set to 0" checkboxes: a line nulled for the customer or
// the partner costs 0 on that side, and the stored lines still add up.
describe("priceWebsiteOrder — lines set to 0", () => {
  it("zeroes a product line for the customer only", () => {
    const base = priceWebsiteOrder(input("21")).result.totals;
    const i = input("21", [card(0, { nulledLineKeysForCustomer: ["opt:inst-1"] }), card(1, { selectedInstallOptionIds: [] })]);
    const { totals } = priceWebsiteOrder(i).result;
    expect(base.totalExVat - totals.totalExVat).toBe(610);
    expect(totals.subcontractorTotal).toBe(base.subcontractorTotal);
    expect(linesTotal(i)).toBeCloseTo(totals.totalExVat, 2);
  });

  it("zeroes a product line for the partner only, on the stored line too", () => {
    const base = priceWebsiteOrder(input("21")).result.totals;
    const cards = [card(0, { nulledLineKeysForSubcontractor: ["opt:inst-1"] }), card(1, { selectedInstallOptionIds: [] })];
    const { totals } = priceWebsiteOrder(input("21", cards)).result;
    expect(base.subcontractorTotal - totals.subcontractorTotal).toBe(400);
    expect(totals.totalExVat).toBe(base.totalExVat);
    const install = buildWebsiteOrderItems(cards, [washer], [], { drivingDistance: "21" }).find((item) => item.optionId === "inst-1");
    expect(install).toMatchObject({ customerPriceCents: 61000, subcontractorPriceCents: 0 });
  });

  it("zeroes an order extra (the floor surcharge) for the customer", () => {
    const settings = normalizePriceListSettings(null);
    settings.floorSurcharge = { ...settings.floorSurcharge, price: "70", subcontractorPrice: "30" };
    const i = { ...input("21"), priceListSettings: settings };
    const floorCode = i.priceListSettings.floorSurcharge.code;
    const base = priceWebsiteOrder(i);
    const floor = base.orderExtras.find((extra) => extra.label === i.priceListSettings.floorSurcharge.description)!;
    expect(floor.price).toBeGreaterThan(0);

    const nulled = priceWebsiteOrder({ ...i, nulledOrderExtraKeys: { customer: [`code:${floorCode}`], subcontractor: [] } });
    expect(nulled.orderExtras.find((extra) => extra.label === floor.label)?.price).toBe(0);
    expect(base.result.totals.totalExVat - nulled.result.totals.totalExVat).toBeCloseTo(floor.price, 2);
    expect(nulled.result.totals.subcontractorTotal).toBe(base.result.totals.subcontractorTotal);
  });
});

describe("priceWebsiteOrder — Other furniture small/large", () => {
  const sizeOption = (id: string, code: string, category: string, extra: Partial<CatalogProduct["options"][number]> = {}) => ({
    id,
    code,
    label: code,
    description: "",
    category,
    customerPrice: "0",
    subcontractorPrice: "0",
    effectiveCustomerPrice: "0",
    active: true,
    ...extra,
  });
  const other: CatalogProduct = {
    ...washer,
    id: "p-other",
    code: "FN_OTHER_FURNITURE",
    deliveryTypes: [
      deliveryType(DELIVERY_TYPES.FIRST_STEP, "616", "Doorstep"),
      deliveryType(DELIVERY_TYPES.INDOOR, "696", "Delivery with carry-in"),
    ],
    options: [
      sizeOption("vol-s", "OF_VOL_SM", "size_volume", { weightClass: "LIGHT" }),
      sizeOption("vol-l", "OF_VOL_LG", "size_volume", { weightClass: "HEAVY" }),
      sizeOption("wt-s", "OF_WT_SM", "size_weight", { weightClass: "LIGHT" }),
      sizeOption("wt-l", "OF_WT_LG", "size_weight", { weightClass: "HEAVY" }),
      sizeOption("large-first", "OF_LG_FIRST_STEP", "size_large_delivery", { customerPrice: "1040", effectiveCustomerPrice: "1040", subcontractorPrice: "620" }),
      sizeOption("large-indoor", "OF_LG_INDOOR", "size_large_delivery", { customerPrice: "1344", effectiveCustomerPrice: "1344", subcontractorPrice: "825" }),
    ],
  };
  const otherCard = (cardId: number, sizeIds: string[]) =>
    card(cardId, { productId: "p-other", selectedInstallOptionIds: [], selectedReturnOptionId: null, selectedExtraOptionIds: sizeIds });
  const sizedInput = (cards: SavedProductCard[]): WebsiteOrderPricingInput => ({
    ...input("21", cards),
    catalogProducts: [washer, other],
  });
  const carryIn = (i: WebsiteOrderPricingInput) =>
    priceWebsiteOrder(i).result.breakdowns.flatMap((b) => b.lines).filter((l) => l.label === "Delivery with carry-in").map((l) => l.lineTotal);

  it("delivers a small item (≤ 1.5 m³ and ≤ 50 kg) at the product's own price", () => {
    expect(carryIn(sizedInput([otherCard(0, ["vol-s", "wt-s"])]))).toEqual([696]);
  });

  it("delivers a large item at the large-item price, whether the volume or the weight is large", () => {
    expect(carryIn(sizedInput([otherCard(0, ["vol-l", "wt-s"])]))).toEqual([1344]);
    expect(carryIn(sizedInput([otherCard(0, ["vol-s", "wt-l"])]))).toEqual([1344]);
  });

  it("lets the large item keep the full delivery price next to a washer (the washer gets the extra-item rate)", () => {
    const i = sizedInput([card(0, { selectedInstallOptionIds: [], selectedReturnOptionId: null }), otherCard(1, ["vol-l", "wt-s"])]);
    expect(carryIn(i)).toEqual([235, 1344]);
  });

  it("stores the same delivery prices, so the stored lines add up to the total", () => {
    const i = sizedInput([card(0, { selectedInstallOptionIds: [], selectedReturnOptionId: null }), otherCard(1, ["vol-s", "wt-l"])]);
    const items = buildWebsiteOrderItems(i.cards, i.catalogProducts, i.catalogSpecialOptions, { drivingDistance: i.drivingDistance });
    const lines = items.reduce((sum, item) => sum + (item.customerPriceCents ?? 0), 0) / 100;
    const { result, orderExtras } = priceWebsiteOrder(i);
    expect(lines + orderExtras.reduce((sum, extra) => sum + extra.price, 0)).toBeCloseTo(result.totals.totalExVat, 2);
    expect(items.some((item) => item.customerPriceCents === 134400)).toBe(true);
  });

  describe("return and no-lift floors", () => {
    const charge = (code: string, price: string) => ({ code, description: code, price, subcontractorPrice: "0" });
    const weighted = normalizePriceListSettings({
      weightClassPricing: {
        floorSurcharge: { LIGHT: charge("FLOOR_SURCHARGE_LIGHT", "32"), MEDIUM: charge("FLOOR_SURCHARGE_MEDIUM", "56"), HEAVY: charge("FLOOR_SURCHARGE_HEAVY", "80") },
        returnPrice: { LIGHT: charge("RETURN_LIGHT", "80"), MEDIUM: charge("RETURN_MEDIUM", "152"), HEAVY: charge("RETURN_HEAVY", "304") },
      },
    } as never);
    // As the website catalog loads it: the list's class prices on the product.
    const withReturn: CatalogProduct = {
      ...other,
      weightClassPricing: weighted.weightClassPricing,
      options: [...other.options, { ...washer.options[1], id: "other-ret" }],
    };
    const priced = (sizeIds: string[]) => {
      const i: WebsiteOrderPricingInput = {
        ...input("21", [{ ...otherCard(0, sizeIds), selectedReturnOptionId: "other-ret" }]),
        catalogProducts: [withReturn],
        priceListSettings: weighted,
      };
      const { result, orderExtras } = priceWebsiteOrder(i);
      return {
        returnPrice: result.breakdowns.flatMap((b) => b.lines).find((l) => l.label === "Retur av gammel vare til gjenvinning")?.lineTotal,
        floor: orderExtras.find((extra) => extra.label.startsWith("FLOOR_SURCHARGE"))?.label,
      };
    };

    it("prices a small item's return and floors as light", () => {
      expect(priced(["vol-s", "wt-s"])).toEqual({ returnPrice: 80, floor: "FLOOR_SURCHARGE_LIGHT" });
    });

    it("prices a large item's return and floors as heavy", () => {
      expect(priced(["vol-s", "wt-l"])).toEqual({ returnPrice: 304, floor: "FLOOR_SURCHARGE_HEAVY" });
      expect(priced(["vol-l", "wt-s"])).toEqual({ returnPrice: 304, floor: "FLOOR_SURCHARGE_HEAVY" });
    });
  });
});

describe("priceWebsiteOrder — weight classes", () => {
  const charge = (code: string, price: string, subcontractorPrice: string) => ({ code, description: code, price, subcontractorPrice });
  const weighted = normalizePriceListSettings({
    weightClassPricing: {
      floorSurcharge: {
        LIGHT: charge("FLOOR_SURCHARGE_LIGHT", "32", "10"),
        MEDIUM: charge("FLOOR_SURCHARGE_MEDIUM", "56", "20"),
        HEAVY: charge("FLOOR_SURCHARGE_HEAVY", "80", "30"),
      },
      returnPrice: {
        LIGHT: charge("RETURN_LIGHT", "80", "45"),
        MEDIUM: charge("RETURN_MEDIUM", "152", "90"),
        HEAVY: charge("RETURN_HEAVY", "304", "180"),
      },
    },
  } as never);
  const sofa: CatalogProduct = {
    ...washer,
    id: "p-sofa",
    code: "FN_SOFA",
    weightClass: "HEAVY",
    options: washer.options.map((o) => ({ ...o, id: `sofa-${o.id}` })),
  };
  const weightedInput = (cards: SavedProductCard[]): WebsiteOrderPricingInput => ({
    ...input("21", cards),
    catalogProducts: [washer, sofa],
    priceListSettings: weighted,
  });
  const lineTotal = (i: WebsiteOrderPricingInput, label: string) =>
    priceWebsiteOrder(i).result.breakdowns.flatMap((b) => b.lines).filter((l) => l.label === label).map((l) => l.lineTotal);

  it("charges the no-lift floors at the heaviest item's class (a washer without a class is light)", () => {
    // Delivery to the 3rd floor, no lift: 1 chargeable floor.
    const floorLine = (i: WebsiteOrderPricingInput) => priceWebsiteOrder(i).orderExtras.find((extra) => extra.label.startsWith("FLOOR_SURCHARGE"));
    expect(floorLine(weightedInput([card(0)]))).toMatchObject({ label: "FLOOR_SURCHARGE_LIGHT", price: 32, qty: 1 });
    const withSofa = weightedInput([card(0), card(1, { productId: "p-sofa", selectedInstallOptionIds: [], selectedReturnOptionId: "sofa-ret-1" })]);
    expect(floorLine(withSofa)).toMatchObject({ label: "FLOOR_SURCHARGE_HEAVY", price: 80, qty: 1 });
  });

  it("prices each return at its own item's class, not the option's own price", () => {
    const i = weightedInput([card(0), card(1, { productId: "p-sofa", selectedInstallOptionIds: [], selectedReturnOptionId: "sofa-ret-1" })]);
    expect(lineTotal(i, "Retur av gammel vare til gjenvinning").sort((a, b) => a - b)).toEqual([80, 304]);
  });

  it("stores the same return prices, so the stored lines still add up to the total", () => {
    const i = weightedInput([card(0), card(1, { productId: "p-sofa", selectedInstallOptionIds: [], selectedReturnOptionId: "sofa-ret-1" })]);
    const items = buildWebsiteOrderItems(i.cards, i.catalogProducts, i.catalogSpecialOptions, {
      drivingDistance: i.drivingDistance,
      priceListSettings: i.priceListSettings,
    });
    const lines = items.reduce((sum, item) => sum + (item.customerPriceCents ?? 0), 0) / 100;
    const { result, orderExtras } = priceWebsiteOrder(i);
    expect(lines + orderExtras.reduce((sum, extra) => sum + extra.price, 0)).toBeCloseTo(result.totals.totalExVat, 2);
    expect(items.filter((item) => item.itemType === "RETURN_OPTION").map((item) => item.customerPriceCents).sort((a, b) => a! - b!)).toEqual([8000, 30400]);
  });
});
