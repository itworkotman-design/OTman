import { describe, expect, it } from "vitest";
import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { findCardsWithDisallowedInstallAddOns, isInstallAddOnAllowed } from "./installAddOnRequirements";

describe("isInstallAddOnAllowed", () => {
  it("hides the integrated front panel on the upright freezer and fridge-freezer when freestanding is chosen", () => {
    expect(isInstallAddOnAllowed("UPRIGHT_FREEZER_INT_FP", "UPRIGHT_FREEZER_FS")).toBe(false);
    expect(isInstallAddOnAllowed("FRIDGE_FREEZER_INT_FP", "FRIDGE_FREEZER_FS")).toBe(false);
    expect(isInstallAddOnAllowed("UPRIGHT_FREEZER_INT_FP", "UPRIGHT_FREEZER_INT_NOFP")).toBe(true);
    expect(isInstallAddOnAllowed("FRIDGE_FREEZER_INT_FP", "FRIDGE_FREEZER_INT_NOFP")).toBe(true);
    expect(isInstallAddOnAllowed("FRIDGE_FREEZER_INT_FP", undefined)).toBe(true);
  });

  it("leaves every other add-on unrestricted", () => {
    expect(isInstallAddOnAllowed("INTEGRATED_FRONT", undefined)).toBe(true);
    expect(isInstallAddOnAllowed("INTEGRATED_FRONT", "DW_INTEGRATED")).toBe(true);
    // The TV stand is its own install type now, not an add-on tied to table mounting.
    expect(isInstallAddOnAllowed("TV_MOUNT_STAND_75_100", undefined)).toBe(true);
  });
});

function option(id: string, code: string) {
  return { id, code, label: code, category: "install", customerPrice: "0", subcontractorPrice: "0", active: true };
}

describe("findCardsWithDisallowedInstallAddOns", () => {
  it("accepts a TV card with only the stand (its own install type)", () => {
    const tv = {
      id: "tv",
      code: "WG_TV",
      label: "TV",
      active: true,
      options: [option("wall", "TV_WALL_75_100"), option("stand", "TV_MOUNT_STAND_75_100")],
    } as unknown as CatalogProduct;
    const card = (cardId: number, ids: string[]) =>
      ({ cardId, productId: "tv", selectedInstallOptionIds: ids }) as unknown as SavedProductCard;
    expect(findCardsWithDisallowedInstallAddOns([card(1, ["stand"]), card(2, ["wall"]), card(3, [])], [tv])).toEqual([]);
  });

  it("flags a fridge-freezer card with freestanding plus the integrated front panel", () => {
    const fridge = {
      id: "fridge",
      code: "WG_FRIDGE_FREEZER",
      label: "Fridge",
      active: true,
      options: [option("fs", "FRIDGE_FREEZER_FS"), option("int", "FRIDGE_FREEZER_INT_NOFP"), option("fp", "FRIDGE_FREEZER_INT_FP")],
    } as unknown as CatalogProduct;
    const fridgeCard = (cardId: number, ids: string[]) =>
      ({ cardId, productId: "fridge", selectedInstallOptionIds: ids }) as unknown as SavedProductCard;

    expect(
      findCardsWithDisallowedInstallAddOns(
        [fridgeCard(1, ["fp", "fs"]), fridgeCard(2, ["int", "fp"]), fridgeCard(3, ["fp"])],
        [fridge],
      ),
    ).toEqual([1]);
  });
});
