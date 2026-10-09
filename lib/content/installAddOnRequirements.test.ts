import { describe, expect, it } from "vitest";
import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { findCardsWithDisallowedInstallAddOns, isInstallAddOnAllowed } from "./installAddOnRequirements";

describe("isInstallAddOnAllowed", () => {
  it("allows the TV stand / feet add-on only with table mounting 75\"-100\"", () => {
    expect(isInstallAddOnAllowed("TV_MOUNT_STAND_75_100", "TV_TABLE_75_100")).toBe(true);
    expect(isInstallAddOnAllowed("TV_MOUNT_STAND_75_100", "TV_WALL_75_100")).toBe(false);
    expect(isInstallAddOnAllowed("TV_MOUNT_STAND_75_100", "TV_TABLE_55_74")).toBe(false);
    expect(isInstallAddOnAllowed("TV_MOUNT_STAND_75_100", undefined)).toBe(false);
  });

  it("leaves every other add-on unrestricted", () => {
    expect(isInstallAddOnAllowed("INTEGRATED_FRONT", undefined)).toBe(true);
    expect(isInstallAddOnAllowed("INTEGRATED_FRONT", "DW_INTEGRATED")).toBe(true);
  });
});

function option(id: string, code: string) {
  return { id, code, label: code, category: "install", customerPrice: "0", subcontractorPrice: "0", active: true };
}

const tv = {
  id: "tv",
  code: "WG_TV",
  label: "TV",
  active: true,
  options: [option("table", "TV_TABLE_75_100"), option("wall", "TV_WALL_75_100"), option("stand", "TV_MOUNT_STAND_75_100")],
} as unknown as CatalogProduct;

function card(cardId: number, selectedInstallOptionIds: string[]) {
  return { cardId, productId: "tv", selectedInstallOptionIds } as unknown as SavedProductCard;
}

describe("findCardsWithDisallowedInstallAddOns", () => {
  it("flags a TV card with wall mounting plus the stand add-on", () => {
    expect(findCardsWithDisallowedInstallAddOns([card(1, ["wall", "stand"]), card(2, ["table", "stand"])], [tv])).toEqual([1]);
  });

  it("flags the stand add-on on its own", () => {
    expect(findCardsWithDisallowedInstallAddOns([card(1, ["stand"])], [tv])).toEqual([1]);
  });

  it("accepts cards without the add-on", () => {
    expect(findCardsWithDisallowedInstallAddOns([card(1, ["wall"]), card(2, [])], [tv])).toEqual([]);
  });
});
