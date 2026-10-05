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
