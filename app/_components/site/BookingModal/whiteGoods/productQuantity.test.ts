import { describe, expect, it } from "vitest";
import { createEmptyProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import {
  addAnotherProductCard,
  applyProductQuantity,
  getProductQuantities,
  nextCardId,
  removeProductCard,
} from "./productQuantity";

const card = (cardId: number, productId: string, amount = 1) => ({
  ...createEmptyProductCard(cardId),
  productId,
  amount,
});

describe("nextCardId", () => {
  it("starts at 0 for an empty order", () => {
    expect(nextCardId([])).toBe(0);
  });

  it("is one above the highest id, even when the last card is not the highest", () => {
    // addAnotherProductCard inserts mid-list, so position no longer tracks id.
    expect(nextCardId([card(0, "a"), card(2, "a"), card(1, "b")])).toBe(3);
  });
});

describe("getProductQuantities", () => {
  it("sums the amounts of every card of a product", () => {
    const cards = [card(0, "bed", 1), card(1, "sofa", 2), card(2, "bed", 3)];

    expect(getProductQuantities(cards)).toEqual({ bed: 4, sofa: 2 });
  });

  it("ignores cards with no product", () => {
    expect(getProductQuantities([createEmptyProductCard(0)])).toEqual({});
  });
});

describe("addAnotherProductCard", () => {
  it("inserts a fresh single-unit card right after the product's last card", () => {
    const cards = [card(0, "bed"), card(1, "bed"), card(2, "sofa")];
    const next = addAnotherProductCard(cards, "bed", 3);

    expect(next.map((c) => c.cardId)).toEqual([0, 1, 3, 2]);
    expect(next[2]).toMatchObject({ cardId: 3, productId: "bed", amount: 1, deliveryType: "FIRST_STEP" });
  });

  it("starts with no options selected, rather than copying the original card", () => {
    const configured = { ...card(0, "bed", 2), selectedExtraOptionIds: ["x"], selectedInstallOptionIds: ["y"] };
    const next = addAnotherProductCard([configured], "bed", 1);

    expect(next[1].selectedExtraOptionIds).toEqual([]);
    expect(next[1].selectedInstallOptionIds).toEqual([]);
    expect(next[1].amount).toBe(1);
  });

  it("is a no-op for a product that is not on the order", () => {
    const cards = [card(0, "sofa")];

    expect(addAnotherProductCard(cards, "bed", 1)).toBe(cards);
  });
});

describe("removeProductCard", () => {
  it("removes just that card", () => {
    const cards = [card(0, "bed"), card(1, "bed"), card(2, "sofa")];

    expect(removeProductCard(cards, 1).map((c) => c.cardId)).toEqual([0, 2]);
  });
});

describe("applyProductQuantity with several cards of one product", () => {
  it("adds extra units to the first card", () => {
    const cards = [card(0, "bed", 1), card(1, "bed", 1)];
    const next = applyProductQuantity(cards, "bed", 3, 2);

    expect(next.map((c) => c.amount)).toEqual([2, 1]);
  });

  it("takes units off the last card first, dropping it once empty", () => {
    const cards = [card(0, "bed", 2), card(1, "bed", 1)];
    const next = applyProductQuantity(cards, "bed", 2, 2);

    expect(next.map((c) => [c.cardId, c.amount])).toEqual([[0, 2]]);
  });

  it("keeps earlier cards when the reduction only partly empties the last one", () => {
    const cards = [card(0, "bed", 1), card(1, "bed", 3)];
    const next = applyProductQuantity(cards, "bed", 3, 2);

    expect(next.map((c) => [c.cardId, c.amount])).toEqual([
      [0, 1],
      [1, 2],
    ]);
  });

  it("removes every card of the product at zero, leaving other products alone", () => {
    const cards = [card(0, "bed"), card(1, "sofa"), card(2, "bed")];
    const next = applyProductQuantity(cards, "bed", 0, 3);

    expect(next.map((c) => c.cardId)).toEqual([1]);
  });
});

describe("applyProductQuantity", () => {
  it("adds a new card for a product with no existing card", () => {
    const cards = [createEmptyProductCard(0)];
    const next = applyProductQuantity(cards, "prod-1", 2, 1);

    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ cardId: 1, productId: "prod-1", amount: 2 });
  });

  it("auto-selects the doorstep (FIRST_STEP) delivery type for the very first product added to an empty order", () => {
    const next = applyProductQuantity([], "prod-1", 1, 0);

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ productId: "prod-1", amount: 1, deliveryType: "FIRST_STEP" });
  });

  it("also auto-selects doorstep delivery for a second (and later) product added to a non-empty order", () => {
    // Every product must land with a real delivery type from the moment
    // it's added — never blank — so there's no way to complete an order
    // with a product silently missing its delivery charge because its own
    // buttons were never touched.
    const first = { ...createEmptyProductCard(0), productId: "prod-1", amount: 1, deliveryType: "FIRST_STEP" as const };
    const next = applyProductQuantity([first], "prod-2", 1, 1);

    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ productId: "prod-2", amount: 1, deliveryType: "FIRST_STEP" });
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

describe("delivery type carried over to a newly added card", () => {
  // The customer picks carry-in on the first product, then adds four more:
  // each new card starts with carry-in too instead of doorstep.
  const withDelivery = (cardId: number, productId: string, deliveryType: "FIRST_STEP" | "INDOOR" | "INSTALL_ONLY") => ({
    ...card(cardId, productId),
    deliveryType,
  });
  const offers = (...keys: string[]) =>
    (["FIRST_STEP", "INDOOR", "INSTALL_ONLY"] as const).map((key) => ({
      key,
      enabled: keys.includes(key),
      code: key,
      label: key,
      price: "0",
      xtraPrice: "0",
      allowInstallOptions: true,
      allowExtraServices: true,
      allowReturnOptions: true,
      allowModelNumber: true,
    }));

  it("copies carry-in from the previous card to a new product", () => {
    const next = applyProductQuantity([withDelivery(0, "dw", "INDOOR")], "wm", 1, 1, offers("FIRST_STEP", "INDOOR"));

    expect(next[1]).toMatchObject({ productId: "wm", deliveryType: "INDOOR" });
  });

  it("copies from the card the new one is placed after, for each further product", () => {
    let cards = applyProductQuantity([withDelivery(0, "dw", "INDOOR")], "wm", 1, 1, offers("FIRST_STEP", "INDOOR"));
    cards = applyProductQuantity(cards, "td", 1, 2, offers("FIRST_STEP", "INDOOR"));

    expect(cards.map((c) => c.deliveryType)).toEqual(["INDOOR", "INDOOR", "INDOOR"]);
  });

  it("copies the previous card's delivery for 'add another' of the same product", () => {
    const next = addAnotherProductCard([withDelivery(0, "bed", "INDOOR"), withDelivery(1, "sofa", "FIRST_STEP")], "bed", 2, offers("FIRST_STEP", "INDOOR"));

    expect(next[1]).toMatchObject({ cardId: 2, productId: "bed", deliveryType: "INDOOR" });
  });

  it("falls back to doorstep when the new product has no carry-in (pallet)", () => {
    const next = applyProductQuantity([withDelivery(0, "dw", "INDOOR")], "pallet", 1, 1, offers("FIRST_STEP"));

    expect(next[1].deliveryType).toBe("FIRST_STEP");
  });

  it("does not copy installation only, which would leave the new product with nothing picked to install", () => {
    const next = applyProductQuantity([withDelivery(0, "wm", "INSTALL_ONLY")], "dw", 1, 1, offers("FIRST_STEP", "INDOOR", "INSTALL_ONLY"));

    expect(next[1].deliveryType).toBe("FIRST_STEP");
  });
});
