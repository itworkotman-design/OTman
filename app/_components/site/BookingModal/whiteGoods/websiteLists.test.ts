import { describe, expect, it } from "vitest";
import { cardsForList, filterUnusedLists, isListConfigured, removeListCards, type WebsiteListInfo } from "./websiteLists";
import {
  createEmptyProductCard,
  type CatalogProduct,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

const wg: WebsiteListInfo = { code: "WEBSITE_WHITE_GOODS", labelEn: "White goods", labelNo: "Hvitevarer", iconCode: "WG_WASHING_MACHINE" };
const fn: WebsiteListInfo = { code: "WEBSITE_FURNITURE", labelEn: "Furniture", labelNo: "Møbler", iconCode: "FN_SOFA" };

describe("filterUnusedLists", () => {
  it("offers every available list except the ones already used, in order", () => {
    expect(filterUnusedLists([wg, fn], ["WEBSITE_WHITE_GOODS"])).toEqual([fn]);
    expect(filterUnusedLists([wg, fn], [])).toEqual([wg, fn]);
  });

  it("offers nothing once every list has been used", () => {
    expect(filterUnusedLists([wg, fn], ["WEBSITE_WHITE_GOODS", "WEBSITE_FURNITURE"])).toEqual([]);
  });

  it("ignores used codes that aren't available (e.g. a list that isn't seeded)", () => {
    expect(filterUnusedLists([wg], ["SOMETHING_ELSE"])).toEqual([wg]);
  });
});

describe("per-list card helpers", () => {
  const products = [{ id: "a" }, { id: "b" }] as unknown as CatalogProduct[];
  const card = (cardId: number, productId: string | null, deliveryType = "FIRST_STEP") =>
    ({ ...createEmptyProductCard(cardId), productId, deliveryType }) as SavedProductCard;
  const cards = [card(0, "a"), card(1, "other-list"), card(2, "b", "")];

  it("cardsForList keeps only the cards whose product is in that list", () => {
    expect(cardsForList(cards, products).map((c) => c.cardId)).toEqual([0, 2]);
  });

  it("removeListCards drops that list's cards and keeps the rest", () => {
    expect(removeListCards(cards, products).map((c) => c.cardId)).toEqual([1]);
  });

  it("isListConfigured needs at least one card and a delivery type on every card", () => {
    expect(isListConfigured([], products)).toBe(false);
    expect(isListConfigured(cards, products)).toBe(false); // card 2 has no delivery type
    expect(isListConfigured([card(0, "a"), card(3, "b", "INDOOR")], products)).toBe(true);
  });
});
