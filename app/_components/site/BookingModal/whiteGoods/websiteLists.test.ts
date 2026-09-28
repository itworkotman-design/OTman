import { describe, expect, it } from "vitest";
import {
  cardsForList,
  filterUnusedLists,
  highlightedStartList,
  isListConfigured,
  isOptionsStepReady,
  isProductsStepReady,
  removeListCards,
  type WebsiteListInfo,
} from "./websiteLists";
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

  it("isListConfigured also needs a volume and a weight bracket on size-priced products (Other furniture)", () => {
    const sized = [
      {
        id: "s",
        options: [
          { id: "v1", category: "size_volume", active: true, customerPrice: "0" },
          { id: "w1", category: "size_weight", active: true, customerPrice: "0" },
        ],
      },
    ] as unknown as CatalogProduct[];
    const sizedCard = (selectedExtraOptionIds: string[]) => ({ ...card(0, "s"), selectedExtraOptionIds }) as SavedProductCard;

    expect(isListConfigured([sizedCard([])], sized)).toBe(false);
    expect(isListConfigured([sizedCard(["v1"])], sized)).toBe(false);
    expect(isListConfigured([sizedCard(["v1", "w1"])], sized)).toBe(false); // still no name for the item
    expect(isListConfigured([{ ...sizedCard(["v1", "w1"]), modelNumber: "Piano" }], sized)).toBe(true);
  });
});

describe("list step readiness (a list emptied later must not collapse the order)", () => {
  it("products step: ready with its own products", () => {
    expect(isProductsStepReady({ ownCount: 2, orderCount: 3, wasPopulated: true })).toBe(true);
  });

  it("products step: a list with size-priced products waits until every one has its volume and weight chosen", () => {
    expect(isProductsStepReady({ ownCount: 1, orderCount: 1, wasPopulated: false, sizeBracketsComplete: false })).toBe(false);
    expect(isProductsStepReady({ ownCount: 1, orderCount: 1, wasPopulated: true, sizeBracketsComplete: false })).toBe(false);
    expect(isProductsStepReady({ ownCount: 1, orderCount: 1, wasPopulated: false, sizeBracketsComplete: true })).toBe(true);
    // omitted = nothing to choose (ordinary lists)
    expect(isProductsStepReady({ ownCount: 1, orderCount: 1, wasPopulated: false })).toBe(true);
  });

  it("products step: a list that had products and was emptied is NOT holding the order back while other lists have products", () => {
    expect(isProductsStepReady({ ownCount: 0, orderCount: 3, wasPopulated: true })).toBe(true);
  });

  it("products step: a newly added list with no products yet still waits, even though other lists have products", () => {
    expect(isProductsStepReady({ ownCount: 0, orderCount: 3, wasPopulated: false })).toBe(false);
  });

  it("products step: once the whole order is empty, every list waits again", () => {
    expect(isProductsStepReady({ ownCount: 0, orderCount: 0, wasPopulated: true })).toBe(false);
  });

  it("options step: with own products it follows whether they are all configured", () => {
    expect(isOptionsStepReady({ ownCount: 2, configured: true, orderCount: 2, wasPopulated: true })).toBe(true);
    expect(isOptionsStepReady({ ownCount: 2, configured: false, orderCount: 2, wasPopulated: true })).toBe(false);
  });

  it("options step: an emptied list doesn't block; a never-populated one does", () => {
    expect(isOptionsStepReady({ ownCount: 0, configured: false, orderCount: 3, wasPopulated: true })).toBe(true);
    expect(isOptionsStepReady({ ownCount: 0, configured: false, orderCount: 3, wasPopulated: false })).toBe(false);
    expect(isOptionsStepReady({ ownCount: 0, configured: false, orderCount: 0, wasPopulated: true })).toBe(false);
  });
});

describe("highlightedStartList", () => {
  const makeCard = (cardId: number, productId: string) => ({ ...createEmptyProductCard(cardId), productId }) as SavedProductCard;
  const productsByList = { wg: [{ id: "a" }], fn: [{ id: "b" }] } as unknown as Record<string, CatalogProduct[]>;

  it("is the first chosen list that still has products — so emptying white goods makes furniture the start", () => {
    expect(highlightedStartList(["wg", "fn"], [makeCard(1, "b")], productsByList)).toBe("fn");
    expect(highlightedStartList(["wg", "fn"], [makeCard(0, "a"), makeCard(1, "b")], productsByList)).toBe("wg");
  });

  it("falls back to the first chosen list when nothing is picked, and null when nothing is chosen", () => {
    expect(highlightedStartList(["wg", "fn"], [], productsByList)).toBe("wg");
    expect(highlightedStartList([], [], productsByList)).toBeNull();
  });
});
