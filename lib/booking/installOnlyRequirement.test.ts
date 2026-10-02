import { describe, expect, it } from "vitest";
import { findInstallOnlyCardsMissingInstall } from "./installOnlyRequirement";
import { catalogProductFromSeed } from "@/lib/content/websiteCatalogFixtures";
import {
  createEmptyProductCard,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// "Installation only" without an installation picked is an order for nothing
// — it must always carry at least one of the product's install options.
const dishwasher = catalogProductFromSeed("WG_DISHWASHER");
const products = [dishwasher];
const installId = dishwasher.options.find((o) => o.category === "install")!.id;

function card(cardId: number, patch: Partial<SavedProductCard>): SavedProductCard {
  return { ...createEmptyProductCard(cardId), productId: dishwasher.id, ...patch };
}

describe("findInstallOnlyCardsMissingInstall", () => {
  it("flags an installation-only card with no install option", () => {
    expect(findInstallOnlyCardsMissingInstall([card(1, { deliveryType: "INSTALL_ONLY" })], products)).toEqual([1]);
  });

  it("accepts an installation-only card with an install option", () => {
    const cards = [card(1, { deliveryType: "INSTALL_ONLY", selectedInstallOptionIds: [installId] })];
    expect(findInstallOnlyCardsMissingInstall(cards, products)).toEqual([]);
  });

  it("doesn't count an id that isn't one of the product's options", () => {
    const cards = [card(1, { deliveryType: "INSTALL_ONLY", selectedInstallOptionIds: ["made-up"] })];
    expect(findInstallOnlyCardsMissingInstall(cards, products)).toEqual([1]);
  });

  it("ignores delivered cards without installation", () => {
    expect(findInstallOnlyCardsMissingInstall([card(1, { deliveryType: "INDOOR" })], products)).toEqual([]);
  });
});
