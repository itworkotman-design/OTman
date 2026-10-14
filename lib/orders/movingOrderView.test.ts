import { describe, expect, it } from "vitest";
import { isMovingOrderItems, movingOrderPriceView } from "./movingOrderView";

const item = (productCode: string, optionLabel: string, quantity: number, customerPriceCents: number, subcontractorPriceCents: number) => ({
  productCode,
  optionCode: optionLabel,
  optionLabel,
  quantity,
  customerPriceCents,
  subcontractorPriceCents,
});

// As stored by the moving route: unit price × quantity.
const items = [
  item("MOVING_BY_SIZE", "Under 40 m²", 1, 500000, 300000),
  item("MOVING_ADDITIONAL_SERVICES", "Move-out cleaning", 1, 480000, 250000),
  item("MOVING_FLOOR_SURCHARGE", "Floor surcharge, moving from (3 floors)", 3, 40000, 20000),
  item("MOVING_CARRY_SURCHARGE", "Carrying distance: within 50 m, moving from", 1, 50000, 25000),
  item("MOVING_DISTANCE", "Distance (43 km)", 43, 2890, 1651),
];

describe("movingOrderPriceView", () => {
  it("shows the move as one product (size + services) and the surcharges and km as order extras, in kroner", () => {
    expect(movingOrderPriceView(items, "customer")).toEqual({
      products: [
        {
          cardId: 0,
          productName: "Moving",
          total: 9800,
          items: [
            { label: "Under 40 m²", qty: 1, price: 5000 },
            { label: "Move-out cleaning", qty: 1, price: 4800 },
          ],
        },
      ],
      orderExtras: [
        { label: "Floor surcharge, moving from (3 floors)", qty: 3, price: 1200 },
        { label: "Carrying distance: within 50 m, moving from", qty: 1, price: 500 },
        { label: "Distance (43 km)", qty: 43, price: Math.round((2890 * 43) / 100) },
      ],
      total: 9800 + 1200 + 500 + Math.round((2890 * 43) / 100),
    });
  });

  it("gives the partner's side from the partner prices", () => {
    const view = movingOrderPriceView(items, "partner");
    expect(view.products[0].items.map((i) => i.price)).toEqual([3000, 2500]);
    expect(view.orderExtras.map((l) => l.price)).toEqual([600, 250, Math.round((1651 * 43) / 100)]);
    expect(view.total).toBe(3000 + 2500 + 600 + 250 + Math.round((1651 * 43) / 100));
  });

  it("matches the stored order total the route computed (rounded per line)", () => {
    // movingOrderPricing rounds each line to whole kroner before summing.
    expect(movingOrderPriceView(items, "customer").total).toBe(5000 + 4800 + 1200 + 500 + Math.round(124270 / 100));
  });
});

describe("isMovingOrderItems", () => {
  it("recognises a move by its size line", () => {
    expect(isMovingOrderItems(items)).toBe(true);
    expect(isMovingOrderItems([item("FRIDGE", "Fridge", 1, 1, 1)])).toBe(false);
  });
});
