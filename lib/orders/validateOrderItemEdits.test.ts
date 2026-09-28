import { describe, expect, it } from "vitest";
import { validateOrderItemEdits } from "./validateOrderItemEdits";

type TestCard = {
  cardId: number;
  productId: string | null;
  amount: number;
  deliveryType: string;
  selectedInstallOptionIds: string[];
  selectedExtraOptionIds: string[];
  selectedReturnOptionId: string | null;
  demontEnabled: boolean;
};

function card(overrides: Partial<TestCard> = {}): TestCard {
  return {
    cardId: 0,
    productId: "product-1",
    amount: 1,
    deliveryType: "FIRST_STEP",
    selectedInstallOptionIds: [],
    selectedExtraOptionIds: [],
    selectedReturnOptionId: null,
    demontEnabled: false,
    ...overrides,
  };
}

describe("validateOrderItemEdits", () => {
  it("accepts a submission that only changes delivery type", () => {
    const original = [card({ deliveryType: "FIRST_STEP" })];
    const submitted = [card({ deliveryType: "INDOOR" })];

    expect(validateOrderItemEdits(original, submitted)).toEqual({ ok: true });
  });

  it("accepts a submission that only changes selected addons", () => {
    const original = [card({ selectedExtraOptionIds: [] })];
    const submitted = [card({ selectedExtraOptionIds: ["UNPACKING", "DEMONT"] })];

    expect(validateOrderItemEdits(original, submitted)).toEqual({ ok: true });
  });

  it("accepts multiple cards, each independently changed", () => {
    const original = [card({ cardId: 0, productId: "p1" }), card({ cardId: 1, productId: "p2" })];
    const submitted = [
      card({ cardId: 0, productId: "p1", deliveryType: "INDOOR" }),
      card({ cardId: 1, productId: "p2", selectedExtraOptionIds: ["ANCHOR"] }),
    ];

    expect(validateOrderItemEdits(original, submitted)).toEqual({ ok: true });
  });

  it("rejects a different number of cards (can't add or remove a product)", () => {
    const original = [card({ cardId: 0 })];
    const submitted = [card({ cardId: 0 }), card({ cardId: 1 })];

    expect(validateOrderItemEdits(original, submitted)).toEqual({ ok: false, reason: "CARD_COUNT_CHANGED" });
  });

  it("rejects a submitted card whose id doesn't exist in the original order", () => {
    const original = [card({ cardId: 0 })];
    const submitted = [card({ cardId: 99 })];

    expect(validateOrderItemEdits(original, submitted)).toEqual({ ok: false, reason: "UNKNOWN_CARD" });
  });

  it("rejects swapping which product a card refers to", () => {
    const original = [card({ cardId: 0, productId: "product-1" })];
    const submitted = [card({ cardId: 0, productId: "product-2" })];

    expect(validateOrderItemEdits(original, submitted)).toEqual({ ok: false, reason: "PRODUCT_CHANGED" });
  });

  it("rejects changing the quantity", () => {
    const original = [card({ cardId: 0, amount: 1 })];
    const submitted = [card({ cardId: 0, amount: 2 })];

    expect(validateOrderItemEdits(original, submitted)).toEqual({ ok: false, reason: "QUANTITY_CHANGED" });
  });
});
