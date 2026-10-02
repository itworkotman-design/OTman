import { describe, expect, it } from "vitest";
import {
  getChargeableFloors,
  buildWhiteGoodsCalculatorBreakdowns,
} from "./buildWhiteGoodsCalculatorBreakdowns";
import { createDefaultPriceListSettings } from "@/lib/products/priceListSettings";

describe("getChargeableFloors", () => {
  it("charges 0 floors at or below the 2nd floor", () => {
    expect(getChargeableFloors(0, false)).toBe(0);
    expect(getChargeableFloors(1, false)).toBe(0);
    expect(getChargeableFloors(2, false)).toBe(0);
  });

  it("charges one floor per level above the 2nd, without a lift", () => {
    expect(getChargeableFloors(3, false)).toBe(1);
    expect(getChargeableFloors(5, false)).toBe(3);
  });

  it("charges nothing when a lift is available, regardless of floor", () => {
    expect(getChargeableFloors(3, true)).toBe(0);
    expect(getChargeableFloors(10, true)).toBe(0);
  });

  it("treats a non-finite floor as 0", () => {
    expect(getChargeableFloors(Number.NaN, false)).toBe(0);
  });

  it("mirrors the allowance below ground: the 1st basement is free, each one below it charges", () => {
    expect(getChargeableFloors(-1, false)).toBe(0);
    expect(getChargeableFloors(-2, false)).toBe(1);
    expect(getChargeableFloors(-4, false)).toBe(3);
  });

  it("charges nothing for a basement when a lift is available", () => {
    expect(getChargeableFloors(-3, true)).toBe(0);
  });
});

describe("buildWhiteGoodsCalculatorBreakdowns", () => {
  const settings = createDefaultPriceListSettings();
  settings.floorSurcharge = {
    code: "FLOOR_SURCHARGE",
    description: "Floor surcharge",
    price: "71.208",
    subcontractorPrice: "29.928",
  };

  it("adds no floor-surcharge line when neither floor is chargeable", () => {
    const breakdowns = buildWhiteGoodsCalculatorBreakdowns({
      productBreakdowns: [],
      priceListSettings: settings,
      drivingDistance: "",
      expressDelivery: false,
      extraPickups: [],
      pickupFloor: 2,
      deliveryFloor: 1,
      pickupLiftAvailable: false,
      deliveryLiftAvailable: false,
    });

    const extras = breakdowns.find((b) => b.isOrderExtras);
    const floorItem = extras?.items.find(
      (item) => item.kind === "customPrice" && item.code === "FLOOR_SURCHARGE",
    );

    expect(floorItem).toBeUndefined();
  });

  it("adds a floor-surcharge line sized to the combined chargeable floors of pickup + delivery", () => {
    const breakdowns = buildWhiteGoodsCalculatorBreakdowns({
      productBreakdowns: [],
      priceListSettings: settings,
      drivingDistance: "",
      expressDelivery: false,
      extraPickups: [],
      pickupFloor: 4, // 2 chargeable floors (3rd, 4th)
      deliveryFloor: 3, // 1 chargeable floor (3rd)
      pickupLiftAvailable: false,
      deliveryLiftAvailable: false,
    });

    const extras = breakdowns.find((b) => b.isOrderExtras);
    const floorItem = extras?.items.find(
      (item) => item.kind === "customPrice" && item.code === "FLOOR_SURCHARGE",
    );

    expect(floorItem).toEqual(
      expect.objectContaining({
        kind: "customPrice",
        code: "FLOOR_SURCHARGE",
        qty: 3,
        unitPrice: 71.208,
        subcontractorUnitPrice: 29.928,
      }),
    );
  });

  it("adds no floor-surcharge line when a lift is available at both ends", () => {
    const breakdowns = buildWhiteGoodsCalculatorBreakdowns({
      productBreakdowns: [],
      priceListSettings: settings,
      drivingDistance: "",
      expressDelivery: false,
      extraPickups: [],
      pickupFloor: 6,
      deliveryFloor: 6,
      pickupLiftAvailable: true,
      deliveryLiftAvailable: true,
    });

    const extras = breakdowns.find((b) => b.isOrderExtras);
    const floorItem = extras?.items.find(
      (item) => item.kind === "customPrice" && item.code === "FLOOR_SURCHARGE",
    );

    expect(floorItem).toBeUndefined();
  });

  it("charges only the end without a lift when they differ", () => {
    const breakdowns = buildWhiteGoodsCalculatorBreakdowns({
      productBreakdowns: [],
      priceListSettings: settings,
      drivingDistance: "",
      expressDelivery: false,
      extraPickups: [],
      pickupFloor: 5, // has a lift -> 0 chargeable
      deliveryFloor: 4, // no lift -> 2 chargeable (3rd, 4th)
      pickupLiftAvailable: true,
      deliveryLiftAvailable: false,
    });

    const extras = breakdowns.find((b) => b.isOrderExtras);
    const floorItem = extras?.items.find(
      (item) => item.kind === "customPrice" && item.code === "FLOOR_SURCHARGE",
    );

    expect(floorItem).toEqual(expect.objectContaining({ qty: 2 }));
  });

  it("still applies the underlying express/pickup/km extras unchanged", () => {
    const breakdowns = buildWhiteGoodsCalculatorBreakdowns({
      productBreakdowns: [],
      priceListSettings: settings,
      drivingDistance: "",
      expressDelivery: true,
      extraPickups: [],
      pickupFloor: 0,
      deliveryFloor: 0,
      pickupLiftAvailable: false,
      deliveryLiftAvailable: false,
    });

    const extras = breakdowns.find((b) => b.isOrderExtras);
    const expressItem = extras?.items.find(
      (item) => item.kind === "customPrice" && item.code === settings.expressDelivery.code,
    );

    expect(expressItem).toBeDefined();
  });
});
