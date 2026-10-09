import { describe, expect, it } from "vitest";
import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { validateWebsiteOrderCards } from "./validateWebsiteOrderCards";

function option(id: string, category: string, code = id.toUpperCase()) {
  return {
    id,
    code,
    label: id,
    description: id,
    category,
    customerPrice: "0",
    subcontractorPrice: "0",
    effectiveCustomerPrice: "0",
    active: true,
  };
}

const products = [
  {
    id: "other-furniture",
    code: "FN_OTHER_FURNITURE",
    label: "Other furniture",
    active: true,
    options: [
      option("vol-1", "size_volume", "OF_VOL_1"),
      option("vol-3", "size_volume", "OF_VOL_3"),
      option("wt-1", "size_weight", "OF_WT_1"),
    ],
  },
  { id: "wm", code: "WM", label: "Washing machine", active: true, options: [] },
  {
    id: "tv",
    code: "WG_TV",
    label: "TV",
    active: true,
    options: [
      option("tv-table", "install", "TV_TABLE_75_100"),
      option("tv-wall", "install", "TV_WALL_75_100"),
      option("tv-stand", "install", "TV_MOUNT_STAND_75_100"),
    ],
  },
] as unknown as CatalogProduct[];

function card(overrides: Partial<SavedProductCard> & Record<string, unknown> = {}): SavedProductCard {
  return {
    cardId: 0,
    productId: "wm",
    deliveryType: "firstStep",
    amount: 1,
    selectedInstallOptionIds: [],
    selectedExtraOptionIds: [],
    modelNumber: "",
    ...overrides,
  } as unknown as SavedProductCard;
}

describe("validateWebsiteOrderCards", () => {
  it("accepts a plain product", () => {
    const result = validateWebsiteOrderCards([card()], products);
    expect(result.ok).toBe(true);
  });

  it("refuses a product that isn't sold on the website", () => {
    expect(validateWebsiteOrderCards([card({ productId: "nope" })], products)).toEqual({ ok: false, reason: "UNKNOWN_PRODUCT" });
  });

  it("refuses a size-priced card without both brackets", () => {
    const result = validateWebsiteOrderCards(
      [card({ productId: "other-furniture", modelNumber: "Clock", selectedExtraOptionIds: [] })],
      products,
    );
    expect(result).toEqual({ ok: false, reason: "SIZE_BRACKETS_REQUIRED" });
  });

  it("refuses a size-priced card without a name, and trims the name it keeps", () => {
    const base = { productId: "other-furniture", sizeDimensionsCm: { widthCm: 100, heightCm: 50, lengthCm: 50 }, selectedExtraOptionIds: ["wt-1"] };
    expect(validateWebsiteOrderCards([card({ ...base, modelNumber: "  " })], products)).toEqual({
      ok: false,
      reason: "ITEM_NAME_REQUIRED",
    });
    expect(validateWebsiteOrderCards([card({ ...base, modelNumber: "<b>x</b>" })], products)).toEqual({
      ok: false,
      reason: "ITEM_NAME_REQUIRED",
    });
    const ok = validateWebsiteOrderCards([card({ ...base, modelNumber: "  Clock  " })], products);
    expect(ok.ok && ok.cards[0].modelNumber).toBe("Clock");
  });

  it("refuses the TV stand / feet add-on unless table mounting 75\"-100\" is chosen", () => {
    const tvCard = (ids: string[]) => card({ productId: "tv", deliveryType: "INDOOR", selectedInstallOptionIds: ids });
    expect(validateWebsiteOrderCards([tvCard(["tv-wall", "tv-stand"])], products)).toEqual({
      ok: false,
      reason: "INSTALL_ADDON_NOT_ALLOWED",
    });
    expect(validateWebsiteOrderCards([tvCard(["tv-table", "tv-stand"])], products).ok).toBe(true);
  });

  it("lets an order keep a combination it already had (booked before the rule), but not add it", () => {
    const tvCard = (cardId: number, ids: string[]) =>
      card({ cardId, productId: "tv", deliveryType: "INDOOR", selectedInstallOptionIds: ids });
    const before = [tvCard(1, ["tv-wall", "tv-stand"]), tvCard(2, ["tv-wall"])];

    // Card 1 unchanged (order of ids doesn't matter) — fine.
    expect(validateWebsiteOrderCards([tvCard(1, ["tv-stand", "tv-wall"])], products, { previousCards: before }).ok).toBe(true);
    // Card 2 newly gets the stand — refused.
    expect(validateWebsiteOrderCards([tvCard(2, ["tv-wall", "tv-stand"])], products, { previousCards: before })).toEqual({
      ok: false,
      reason: "INSTALL_ADDON_NOT_ALLOWED",
    });
  });
});
