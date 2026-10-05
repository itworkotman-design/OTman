import { describe, expect, it } from "vitest";

import { buildCalculatorBreakdownsWithOrderExtras } from "./orderCalculatorExtras";
import { createDefaultPriceListSettings } from "@/lib/products/priceListSettings";

function buildKmItems(drivingDistance: string, useFullDistanceKmPricing?: boolean) {
  const priceListSettings = createDefaultPriceListSettings();
  priceListSettings.kmFrom21.price = "10";
  priceListSettings.kmFrom21.subcontractorPrice = "6";
  priceListSettings.kmOver100.price = "8";
  priceListSettings.kmOver100.subcontractorPrice = "5";

  const breakdowns = buildCalculatorBreakdownsWithOrderExtras({
    productBreakdowns: [],
    priceListSettings,
    deviation: "",
    drivingDistance,
    expressDelivery: false,
    extraWorkMinutes: 0,
    feeAddToOrder: false,
    feeExtraWork: false,
    extraPickups: [],
    shouldUseNativeDistancePricing: true,
    ...(useFullDistanceKmPricing === undefined ? {} : { useFullDistanceKmPricing }),
  });

  const extras = breakdowns.find((breakdown) => breakdown.isOrderExtras);
  return (extras?.items ?? []).filter(
    (item) => item.kind === "customPrice" && (item.code === "KM_FROM_21" || item.code === "KM_OVER_100"),
  );
}

describe("buildCalculatorBreakdownsWithOrderExtras distance pricing", () => {
  it("charges nothing at or below 20 km", () => {
    expect(buildKmItems("19 km")).toEqual([]);
    expect(buildKmItems("20 km")).toEqual([]);
  });

  it("charges the full distance on KM_FROM_21 by default once over 20 km", () => {
    expect(buildKmItems("30 km")).toEqual([
      expect.objectContaining({ code: "KM_FROM_21", qty: 30, unitPrice: 10, subcontractorUnitPrice: 6 }),
    ]);
  });

  it("charges the full distance on KM_OVER_100 by default over 100 km", () => {
    expect(buildKmItems("130 km")).toEqual([
      expect.objectContaining({ code: "KM_OVER_100", qty: 130, unitPrice: 8, subcontractorUnitPrice: 5 }),
    ]);
  });

  it("keeps the old km-above-20 rule when full-distance pricing is off (orders before cutoff)", () => {
    expect(buildKmItems("30 km", false)).toEqual([
      expect.objectContaining({ code: "KM_FROM_21", qty: 10 }),
    ]);
    expect(buildKmItems("130 km", false)).toEqual([
      expect.objectContaining({ code: "KM_OVER_100", qty: 110 }),
    ]);
  });
});
