import { describe, expect, it } from "vitest";
import { buildProductBreakdowns } from "./fromProductCards";
import { applyWhiteGoodsExtraUnitCharges } from "./whiteGoodsExtraUnits";
import { applyWebsiteAssemblyExtras } from "./websiteAssemblyExtras";
import { buildPriceLookup } from "./priceLookup";
import { calculateBookingPricing } from "./engine";
import { catalogProductFromSeed } from "@/lib/content/websiteCatalogFixtures";
import { mergeWebsiteCatalogs } from "@/lib/content/mergeWebsiteCatalogs";
import { createDefaultPriceListSettings } from "@/lib/products/priceListSettings";
import {
  createEmptyProductCard,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// One order mixing products from two website price lists (white goods +
// furniture), priced by the same pipeline the modal and the order route use:
// merged catalog -> shared product pricing -> website-only layers -> the one
// calculator. Prices are the 5 kr-rounded seed prices.

const merged = mergeWebsiteCatalogs([
  {
    priceListId: "wg",
    products: [catalogProductFromSeed("WG_DISHWASHER")],
    specialOptions: [],
    priceListSettings: createDefaultPriceListSettings(),
  },
  {
    priceListId: "fn",
    products: [catalogProductFromSeed("FN_BED"), catalogProductFromSeed("FN_SOFA")],
    specialOptions: [],
    priceListSettings: createDefaultPriceListSettings(),
  },
]);

function total(cards: SavedProductCard[]) {
  const breakdowns = applyWebsiteAssemblyExtras(
    applyWhiteGoodsExtraUnitCharges(
      buildProductBreakdowns(cards, merged.products, merged.specialOptions),
      cards,
      merged.products,
      merged.specialOptions,
    ),
    cards,
    merged.products,
  );
  return calculateBookingPricing({
    productBreakdowns: breakdowns,
    priceLookup: buildPriceLookup(merged.products, merged.specialOptions),
  }).totals.subtotalExVat;
}

const card = (cardId: number, productId: string, patch: Partial<SavedProductCard>): SavedProductCard => ({
  ...createEmptyProductCard(cardId),
  productId,
  ...patch,
});

describe("an order mixing white goods and furniture", () => {
  it("prices each product from its own list", () => {
    expect(total([card(0, "WG_DISHWASHER", { deliveryType: "FIRST_STEP" })])).toBe(610);
    expect(total([card(0, "FN_BED", { deliveryType: "FIRST_STEP" })])).toBe(610);
    expect(total([card(0, "FN_SOFA", { deliveryType: "FIRST_STEP" })])).toBe(1030);
  });

  it("gives the most expensive delivery across BOTH lists full price and the other the reduced extra rate", () => {
    // Sofa (heavy, 1030) stays full; the dishwasher drops to its 155 kr extra rate.
    expect(
      total([
        card(0, "WG_DISHWASHER", { deliveryType: "FIRST_STEP" }),
        card(1, "FN_SOFA", { deliveryType: "FIRST_STEP" }),
      ]),
    ).toBe(1030 + 155);
  });

  it("does not discount extra heavy units, but does discount a normal product next to them", () => {
    expect(
      total([
        card(0, "WG_DISHWASHER", { deliveryType: "FIRST_STEP" }),
        card(1, "FN_SOFA", { deliveryType: "FIRST_STEP", amount: 2 }),
      ]),
    ).toBe(1030 + 1030 + 155);
  });

  it("adds furniture assembly plus dismantling on top of carry-in, next to a white-goods delivery", () => {
    // Bed carry-in 690 is the order's dearest delivery, so the dishwasher pays 155.
    // Bed: 690 + IKEA single-bed assembly 850 + dismantling for disposal 400.
    expect(
      total([
        card(0, "WG_DISHWASHER", { deliveryType: "FIRST_STEP" }),
        card(1, "FN_BED", {
          deliveryType: "INDOOR",
          selectedInstallOptionIds: ["ASM_SGL_BED_IKEA"],
          selectedExtraOptionIds: ["DISMANTLE_DISP_SGL_BED"],
        }),
      ]),
    ).toBe(155 + 690 + 850 + 400);
  });
});
