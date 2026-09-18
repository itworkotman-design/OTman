import { describe, expect, it } from "vitest";
import { createEmptyProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { applyProductQuantity } from "./productQuantity";

describe("applyProductQuantity", () => {
  it("adds a new card for a product with no existing card", () => {
    const cards = [createEmptyProductCard(0)];
    const next = applyProductQuantity(cards, "prod-1", 2, 1);

    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ cardId: 1, productId: "prod-1", amount: 2 });
  });

  it("updates the amount on the existing card for that product", () => {
    const cards = [{ ...createEmptyProductCard(0), productId: "prod-1", amount: 1 }];
    const next = applyProductQuantity(cards, "prod-1", 5, 1);

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ productId: "prod-1", amount: 5 });
  });

  it("removes the card when the amount drops to zero", () => {
    const other = { ...createEmptyProductCard(0), productId: "prod-other", amount: 1 };
    const target = { ...createEmptyProductCard(1), productId: "prod-1", amount: 1 };
    const next = applyProductQuantity([other, target], "prod-1", 0, 2);

    expect(next).toEqual([other]);
  });

  it("is a no-op when clearing a product that has no card", () => {
    const cards = [createEmptyProductCard(0)];
    const next = applyProductQuantity(cards, "prod-1", 0, 1);

    expect(next).toBe(cards);
  });

  it("clamps a negative amount to zero (treated as removal)", () => {
    const target = { ...createEmptyProductCard(0), productId: "prod-1", amount: 1 };
    const next = applyProductQuantity([target], "prod-1", -3, 1);

    expect(next).toEqual([]);
  });
});
