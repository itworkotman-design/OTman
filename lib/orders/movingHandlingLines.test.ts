import { describe, expect, it } from "vitest";
import {
  isMovingHandlingItem,
  movingHandlingFromOrder,
  movingHandlingItemRows,
  movingHandlingLinesChanged,
  type MovingHandlingRates,
} from "./movingHandlingLines";

const opt = (code: string, labelEn: string, customerPriceCents: number, subcontractorPriceCents = 0) => ({
  code,
  labelEn,
  labelNo: labelEn,
  customerPriceCents,
  subcontractorPriceCents,
});

const rates: MovingHandlingRates = {
  expressDelivery: opt("EXPRESS_DELIVERY", "Express delivery", 150000, 80000),
  deviations: [
    opt("WRONGADRESS", "Avvik, bomtur; Feil adresse", 59000, 14900),
    opt("CUSTOM", "Custom", 0, 0),
  ],
};

const none = { price: null, subcontractorPrice: null, description: null };

describe("movingHandlingItemRows (express and the deviation on a move, priced from the moving price list's settings)", () => {
  it("adds nothing without express or a deviation", () => {
    expect(movingHandlingItemRows(rates, { expressDelivery: false, deviation: "", customDeviation: none })).toEqual([]);
  });

  it("adds express at the price list's express price", () => {
    expect(movingHandlingItemRows(rates, { expressDelivery: true, deviation: "", customDeviation: none })).toEqual([
      {
        cardId: 0,
        productCode: "MOVING_EXPRESS",
        productName: "Express delivery",
        itemType: "product",
        optionCode: "EXPRESS_DELIVERY",
        optionLabel: "Express delivery",
        quantity: 1,
        customerPriceCents: 150000,
        subcontractorPriceCents: 80000,
      },
    ]);
  });

  it("adds a deviation at its price list price, by its label", () => {
    const [row] = movingHandlingItemRows(rates, { expressDelivery: false, deviation: "Avvik, bomtur; Feil adresse", customDeviation: none });
    expect(row).toMatchObject({
      productCode: "MOVING_DEVIATION",
      optionCode: "WRONGADRESS",
      optionLabel: "Avvik, bomtur; Feil adresse",
      customerPriceCents: 59000,
      subcontractorPriceCents: 14900,
    });
  });

  it("prices a custom deviation with its own prices and names it by its description", () => {
    const [row] = movingHandlingItemRows(rates, {
      expressDelivery: false,
      deviation: "Custom",
      customDeviation: { price: 750, subcontractorPrice: 300, description: "Piano up the stairs" },
    });
    expect(row).toMatchObject({
      productCode: "MOVING_DEVIATION",
      optionCode: "CUSTOM",
      optionLabel: "Piano up the stairs",
      customerPriceCents: 75000,
      subcontractorPriceCents: 30000,
    });
  });

  it("falls back to the deviation's built-in fee when the price list has no rates", () => {
    const [row] = movingHandlingItemRows(null, { expressDelivery: false, deviation: "Avvik, bomtur; Feil adresse", customDeviation: none });
    expect(row).toMatchObject({ customerPriceCents: 59000, subcontractorPriceCents: 14900 });
  });
});

describe("movingHandlingFromOrder", () => {
  const order = {
    driver: null,
    secondDriver: null,
    driverInfo: null,
    licensePlate: null,
    deviation: "Custom",
    description: null,
    expressDelivery: false,
    rabatt: null,
    leggTil: null,
    subcontractorMinus: null,
    subcontractorPlus: null,
    deliveryDate: null,
    timeWindow: null,
    pricingSnapshot: {},
  };

  it("reads a custom deviation's prices and description from its stored line", () => {
    const items = [
      { productCode: "MOVING_DEVIATION", optionCode: "CUSTOM", optionLabel: "Piano", quantity: 1, customerPriceCents: 75000, subcontractorPriceCents: 30000 },
    ];
    expect(movingHandlingFromOrder({ ...order, items }).customDeviation).toEqual({ price: 750, subcontractorPrice: 300, description: "Piano" });
  });

  it("leaves the description empty when the line kept the deviation's own name", () => {
    const items = [
      { productCode: "MOVING_DEVIATION", optionCode: "CUSTOM", optionLabel: "Custom", quantity: 1, customerPriceCents: 0, subcontractorPriceCents: 0 },
    ];
    expect(movingHandlingFromOrder({ ...order, items }).customDeviation).toEqual({ price: 0, subcontractorPrice: 0, description: null });
  });
});

describe("movingHandlingLinesChanged / isMovingHandlingItem", () => {
  const base = { expressDelivery: false, deviation: "", customDeviation: none };

  it("only counts express, the deviation and a custom deviation's own values", () => {
    expect(movingHandlingLinesChanged(base, { ...base })).toBe(false);
    expect(movingHandlingLinesChanged(base, { ...base, expressDelivery: true })).toBe(true);
    expect(movingHandlingLinesChanged(base, { ...base, deviation: "Custom" })).toBe(true);
    expect(movingHandlingLinesChanged(base, { ...base, customDeviation: { ...none, price: 10 } })).toBe(true);
  });

  it("knows its own lines", () => {
    expect(isMovingHandlingItem({ productCode: "MOVING_EXPRESS" })).toBe(true);
    expect(isMovingHandlingItem({ productCode: "MOVING_DEVIATION" })).toBe(true);
    expect(isMovingHandlingItem({ productCode: "MOVING_BY_SIZE" })).toBe(false);
  });
});
