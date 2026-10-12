import { describe, expect, it } from "vitest";
import { findCardsWithoutPickup } from "@/lib/orders/pickupAssignment";

const cards = [
  { cardId: 0, productId: "p-wm" },
  { cardId: 1, productId: "p-sofa" },
];

describe("findCardsWithoutPickup", () => {
  it("is never a problem with a single pickup stop — everything is collected there", () => {
    expect(findCardsWithoutPickup([{}], cards)).toEqual([]);
    expect(findCardsWithoutPickup([{ cardIds: [] }], cards)).toEqual([]);
  });

  it("finds a product no stop collects", () => {
    expect(findCardsWithoutPickup([{ cardIds: [0] }, { cardIds: [] }], cards)).toEqual([1]);
  });

  it("finds a product two stops both claim", () => {
    expect(findCardsWithoutPickup([{ cardIds: [0, 1] }, { cardIds: [1] }], cards)).toEqual([1]);
  });

  it("passes when every product is on exactly one stop", () => {
    expect(findCardsWithoutPickup([{ cardIds: [0] }, { cardIds: [1] }], cards)).toEqual([]);
  });

  it("doesn't count a stop without an address — the product still has nowhere to be collected", () => {
    expect(findCardsWithoutPickup([{ address: "Strømmen 1", cardIds: [0] }, { address: " ", cardIds: [1] }], cards)).toEqual([1]);
  });

  it("ignores empty cards (no product chosen yet)", () => {
    expect(findCardsWithoutPickup([{ cardIds: [0] }, { cardIds: [1] }], [...cards, { cardId: 2, productId: null }])).toEqual([]);
  });

  it("can't check older orders whose stops only stored product names", () => {
    expect(findCardsWithoutPickup([{ cardIds: [0] }, {}], cards)).toEqual([]);
  });
});
