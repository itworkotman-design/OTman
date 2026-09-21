import { describe, expect, it } from "vitest";
import {
  applyWebsiteAssemblyExtras,
  buildWebsiteAssemblyExtraOrderItems,
  isAssemblyCompatibleExtraCode,
} from "./websiteAssemblyExtras";
import { buildProductBreakdowns } from "./fromProductCards";
import { buildPriceLookup } from "./priceLookup";
import { calculateBookingPricing } from "./engine";
import { catalogProductFromSeed } from "@/lib/content/websiteCatalogFixtures";
import { createEmptyProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// On a furniture order, dismantling and wall anchoring are paid extras that
// can be added together with assembly — but the shared pricing drops every
// "extra" option once an assembly (install) option is selected. This website-
// only layer adds them back, so the price matches the source workbook.

const bed = catalogProductFromSeed("FN_BED");
const dishwasher = catalogProductFromSeed("WG_DISHWASHER");

function price(cards: ReturnType<typeof createEmptyProductCard>[], products = [bed], withExtras = true) {
  const base = buildProductBreakdowns(cards, products, []);
  const breakdowns = withExtras ? applyWebsiteAssemblyExtras(base, cards, products) : base;
  return calculateBookingPricing({ productBreakdowns: breakdowns, priceLookup: buildPriceLookup(products, []) }).totals
    .subtotalExVat;
}

const assembledBed = (extra: string[]) => ({
  ...createEmptyProductCard(0),
  productId: "FN_BED",
  deliveryType: "INDOOR" as const,
  selectedInstallOptionIds: ["ASM_SINGLE_BED_IKEA"],
  selectedExtraOptionIds: extra,
});

describe("isAssemblyCompatibleExtraCode", () => {
  it("allows dismantling and wall anchoring, but not unpacking or white-goods demont", () => {
    expect(isAssemblyCompatibleExtraCode("DISMANTLE_DISPOSAL_SINGLE_BED")).toBe(true);
    expect(isAssemblyCompatibleExtraCode("DISMANTLE_CAREFUL_DAYBED")).toBe(true);
    expect(isAssemblyCompatibleExtraCode("WALL_ANCHORING")).toBe(true);
    expect(isAssemblyCompatibleExtraCode("UNPACKING")).toBe(false);
    expect(isAssemblyCompatibleExtraCode("DEMONT")).toBe(false);
  });
});

describe("applyWebsiteAssemblyExtras", () => {
  it("shows the gap it fills: the shared pricing alone leaves dismantling unpriced next to assembly", () => {
    const card = assembledBed(["DISMANTLE_DISPOSAL_SINGLE_BED"]);
    // 690 carry-in + 850 assembly, dismantling (400) silently dropped.
    expect(price([card], [bed], false)).toBe(1540);
  });

  it("prices dismantling + wall anchoring on top of delivery + assembly", () => {
    const card = assembledBed(["DISMANTLE_DISPOSAL_SINGLE_BED", "WALL_ANCHORING"]);
    // 690 + 850 + 400 + 465 (463.368 rounded to 5)
    expect(price([card])).toBe(2405);
  });

  it("scales the extras with the quantity", () => {
    const card = { ...assembledBed(["DISMANTLE_CAREFUL_SINGLE_BED"]), amount: 2 };
    const oneUnit = price([assembledBed(["DISMANTLE_CAREFUL_SINGLE_BED"])]);
    const noExtra = price([{ ...assembledBed([]), amount: 2 }]);
    expect(price([card]) - noExtra).toBe(2 * (oneUnit - price([assembledBed([])])));
  });

  it("does nothing without an assembly option — the shared pricing already prices the extras then", () => {
    const card = {
      ...createEmptyProductCard(0),
      productId: "FN_BED",
      deliveryType: "INDOOR" as const,
      selectedExtraOptionIds: ["DISMANTLE_DISPOSAL_SINGLE_BED"],
    };
    expect(price([card])).toBe(price([card], [bed], false));
    expect(price([card])).toBe(690 + 400);
  });

  it("does not resurrect unpacking that the shared pricing drops under assembly (it's included)", () => {
    expect(price([assembledBed(["UNPACKING"])])).toBe(1540);
  });

  it("never changes white goods: extras stay dropped under installation", () => {
    const card = {
      ...createEmptyProductCard(0),
      productId: "WG_DISHWASHER",
      deliveryType: "INDOOR" as const,
      selectedInstallOptionIds: ["DISHWASHER_STANDARD_WETROOM"],
      selectedExtraOptionIds: ["UNPACKING"],
    };
    expect(price([card], [dishwasher])).toBe(price([card], [dishwasher], false));
  });
});

describe("buildWebsiteAssemblyExtraOrderItems", () => {
  it("produces the saved order lines for the same extras, priced per unit in cents", () => {
    const card = { ...assembledBed(["DISMANTLE_DISPOSAL_SINGLE_BED", "WALL_ANCHORING", "UNPACKING"]), amount: 2 };
    const items = buildWebsiteAssemblyExtraOrderItems([card], [bed]);
    expect(items.map((i) => i.optionCode)).toEqual(["DISMANTLE_DISPOSAL_SINGLE_BED", "WALL_ANCHORING"]);
    expect(items[0]).toMatchObject({
      cardId: 0,
      itemType: "EXTRA_OPTION",
      quantity: 2,
      customerPriceCents: 40000,
      subcontractorPriceCents: 25000,
    });
  });

  it("produces none without an assembly option", () => {
    const card = { ...assembledBed(["DISMANTLE_DISPOSAL_SINGLE_BED"]), selectedInstallOptionIds: [] };
    expect(buildWebsiteAssemblyExtraOrderItems([card], [bed])).toEqual([]);
  });
});
