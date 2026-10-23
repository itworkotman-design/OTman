import { describe, expect, it } from "vitest";
import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import {
  dropExtrasMissingRequirement,
  findCardsWithDisallowedExtraOptions,
  isExtraOptionAllowed,
} from "./extraOptionRequirements";

describe("isExtraOptionAllowed", () => {
  it("allows taking the empty pallet only when the goods are taken off the pallet too", () => {
    expect(isExtraOptionAllowed("PALLET_PICKUP", ["UNPACKING"])).toBe(true);
    expect(isExtraOptionAllowed("PALLET_PICKUP", [])).toBe(false);
  });

  it("leaves every other extra unrestricted", () => {
    expect(isExtraOptionAllowed("UNPACKING", [])).toBe(true);
    expect(isExtraOptionAllowed("WALL_ANCHORING", [])).toBe(true);
  });
});

function option(id: string, code: string) {
  return { id, code, label: code, category: "extra", customerPrice: "0", subcontractorPrice: "0", active: true };
}

const pallet = {
  id: "pall",
  code: "PKG_PALL",
  label: "Pallet",
  active: true,
  options: [option("unload", "UNPACKING"), option("pickup", "PALLET_PICKUP")],
} as unknown as CatalogProduct;

function card(cardId: number, selectedExtraOptionIds: string[]) {
  return { cardId, productId: "pall", selectedInstallOptionIds: [], selectedExtraOptionIds } as unknown as SavedProductCard;
}

describe("findCardsWithDisallowedExtraOptions", () => {
  it("flags a pallet card that takes the empty pallet without taking the goods off it", () => {
    expect(
      findCardsWithDisallowedExtraOptions([card(1, ["pickup"]), card(2, ["unload", "pickup"]), card(3, ["unload"]), card(4, [])], [pallet]),
    ).toEqual([1]);
  });
});

describe("dropExtrasMissingRequirement", () => {
  it("drops taking the empty pallet once taking the goods off is unticked", () => {
    expect(dropExtrasMissingRequirement(["pickup"], pallet.options)).toEqual([]);
    expect(dropExtrasMissingRequirement(["unload", "pickup"], pallet.options)).toEqual(["unload", "pickup"]);
  });
});
