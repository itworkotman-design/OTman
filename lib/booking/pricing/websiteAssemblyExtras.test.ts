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
  selectedInstallOptionIds: ["ASM_SGL_BED_IKEA"],
  selectedExtraOptionIds: extra,
});

describe("isAssemblyCompatibleExtraCode", () => {
  it("allows dismantling and wall anchoring, but not unpacking or white-goods demont", () => {
    expect(isAssemblyCompatibleExtraCode("DISMANTLE_DISP_STD")).toBe(true);
    expect(isAssemblyCompatibleExtraCode("DISMANTLE_CAR_LG")).toBe(true);
    expect(isAssemblyCompatibleExtraCode("WALL_ANCHORING")).toBe(true);
    expect(isAssemblyCompatibleExtraCode("UNPACKING")).toBe(false);
    expect(isAssemblyCompatibleExtraCode("DEMONT")).toBe(false);
  });
});

describe("applyWebsiteAssemblyExtras", () => {
  it("shows the gap it fills: the shared pricing alone leaves dismantling unpriced next to assembly", () => {
    const card = assembledBed(["DISMANTLE_DISP_STD"]);
    // 696 carry-in + 856 assembly, dismantling (480) silently dropped.
    expect(price([card], [bed], false)).toBe(1552);
  });

  it("prices dismantling + wall anchoring on top of delivery + assembly", () => {
    const card = assembledBed(["DISMANTLE_DISP_STD", "WALL_ANCHORING"]);
    // 696 + 856 + 480 + 472 (463.368 → 465 → raised to a multiple of 8)
    expect(price([card])).toBe(2504);
  });

  it("scales the extras with the quantity", () => {
    const card = { ...assembledBed(["DISMANTLE_CAR_STD"]), amount: 2 };
    const oneUnit = price([assembledBed(["DISMANTLE_CAR_STD"])]);
    const noExtra = price([{ ...assembledBed([]), amount: 2 }]);
    expect(price([card]) - noExtra).toBe(2 * (oneUnit - price([assembledBed([])])));
  });

  it("does nothing without an assembly option — the shared pricing already prices the extras then", () => {
    const card = {
      ...createEmptyProductCard(0),
      productId: "FN_BED",
      deliveryType: "INDOOR" as const,
      selectedExtraOptionIds: ["DISMANTLE_DISP_STD"],
    };
    expect(price([card])).toBe(price([card], [bed], false));
    expect(price([card])).toBe(696 + 480);
  });

  it("does not resurrect unpacking that the shared pricing drops under assembly (it's included)", () => {
    expect(price([assembledBed(["UNPACKING"])])).toBe(1552);
  });

  it("never changes white goods: extras stay dropped under installation", () => {
    const card = {
      ...createEmptyProductCard(0),
      productId: "WG_DISHWASHER",
      deliveryType: "INDOOR" as const,
      selectedInstallOptionIds: ["DISHWASHER_STD_WET"],
      selectedExtraOptionIds: ["UNPACKING"],
    };
    expect(price([card], [dishwasher])).toBe(price([card], [dishwasher], false));
  });
});

describe("buildWebsiteAssemblyExtraOrderItems", () => {
  it("produces the saved order lines for the same extras, priced per unit in cents", () => {
    const card = { ...assembledBed(["DISMANTLE_DISP_STD", "WALL_ANCHORING", "UNPACKING"]), amount: 2 };
    const items = buildWebsiteAssemblyExtraOrderItems([card], [bed]);
    expect(items.map((i) => i.optionCode)).toEqual(["DISMANTLE_DISP_STD", "WALL_ANCHORING"]);
    expect(items[0]).toMatchObject({
      cardId: 0,
      itemType: "EXTRA_OPTION",
      quantity: 2,
      customerPriceCents: 48000,
      subcontractorPriceCents: 33500,
    });
  });

  it("produces none without an assembly option", () => {
    const card = { ...assembledBed(["DISMANTLE_DISP_STD"]), selectedInstallOptionIds: [] };
    expect(buildWebsiteAssemblyExtraOrderItems([card], [bed])).toEqual([]);
  });
});
