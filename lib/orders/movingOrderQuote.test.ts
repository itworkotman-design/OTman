import { describe, expect, it, vi } from "vitest";

// getMovingCatalog.ts (the size/service lookups) imports the DB client.
vi.mock("@/lib/db", () => ({ prisma: {} }));
import type { MovingCatalog } from "@/lib/content/getMovingCatalog";
import { parseMovingProperty, type MovingProperty } from "./movingProperty";
import { movingOrderItemRows, priceMovingOrder } from "./movingOrderQuote";

const opt = (code: string, labelEn: string, customerPriceCents: number, subcontractorPriceCents = 0) => ({
  code,
  labelEn,
  labelNo: labelEn,
  customerPriceCents,
  subcontractorPriceCents,
});

const catalog: MovingCatalog = {
  priceListId: "pl-moving",
  options: [opt("SIZE_UNDER_40", "Under 40 m²", 500000, 300000), opt("SIZE_UNDER_100", "Under 100 m²", 1200000, 800000)],
  services: [opt("SERVICE_FLYTTEVASK", "Move-out cleaning", 480000, 250000)],
  floorSurcharge: opt("FLOOR_SURCHARGE_PER_FLOOR", "Floor surcharge", 40000, 20000),
  carrySurcharges: [opt("CARRY_WITHIN_50M", "Carrying distance: within 50 m", 50000, 25000)],
  distanceRates: {
    kmFrom21: opt("KM_FROM_21", "Per km", 2890, 1651),
    kmOver100: opt("KM_OVER_100", "Per km", 2890, 1651),
  },
};

function property(raw: Record<string, unknown>): MovingProperty {
  const parsed = parseMovingProperty(raw);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.property;
}

// 5th floor without a lift → 3 chargeable floors; within 50 m → carry line.
const origin = property({ homeType: "APARTMENT", sizeOptionCode: "SIZE_UNDER_40", floors: 1, floorNumber: 5, hasLift: false, parking: "WITHIN_50M" });
const destination = property({ homeType: "DETACHED", sizeOptionCode: "SIZE_UNDER_100", floors: 2, parking: "OUTSIDE" });

describe("priceMovingOrder (one pricing for the booking route and the admin edit)", () => {
  it("prices the origin's size, services, floor + carry surcharges and the km", () => {
    const quote = priceMovingOrder(catalog, { origin, destination, serviceCodes: ["SERVICE_FLYTTEVASK"], drivingDistance: "42.86" });
    if (!quote.ok) throw new Error(JSON.stringify(quote.errors));
    expect(quote.sizeOption.code).toBe("SIZE_UNDER_40");
    expect(quote.services.map((s) => s.code)).toEqual(["SERVICE_FLYTTEVASK"]);
    expect(quote.floorSurchargeLines.map((l) => [l.quantity, l.customerPriceCents])).toEqual([[3, 120000]]);
    expect(quote.carrySurchargeLines.map((l) => l.code)).toEqual(["CARRY_WITHIN_50M"]);
    expect(quote.distanceLines.map((l) => [l.code, l.quantity])).toEqual([["KM_FROM_21", 43]]);
    // 5 000 + 4 800 + 1 200 + 500 + round(28.90 × 43)
    expect(quote.pricing.priceExVat).toBe(5000 + 4800 + 1200 + 500 + Math.round((2890 * 43) / 100));
    expect(quote.pricing.priceSubcontractor).toBe(3000 + 2500 + 600 + 250 + Math.round((1651 * 43) / 100));
  });

  it("describes both ends for staff and sums the order up", () => {
    const quote = priceMovingOrder(catalog, { origin, destination, serviceCodes: [], drivingDistance: "" });
    if (!quote.ok) throw new Error("not ok");
    expect(quote.originLine).toContain("Apartment, Under 40 m²");
    expect(quote.destinationLine).toContain("Detached house, Under 100 m²");
    expect(quote.summary).toBe("Moving (Under 40 m²) + Floor surcharge, moving from (3 floors) + Carrying distance: within 50 m, moving from");
  });

  it("rejects a size or service that isn't in the catalog", () => {
    const bad = priceMovingOrder(catalog, {
      origin: { ...origin, sizeOptionCode: "SIZE_HUGE" },
      destination: { ...destination, sizeOptionCode: "NOPE" },
      serviceCodes: [],
      drivingDistance: "",
    });
    expect(bad).toEqual({
      ok: false,
      errors: { "origin.sizeOptionCode": "Unknown size option", "destination.sizeOptionCode": "Unknown size option" },
    });
    expect(priceMovingOrder(catalog, { origin, destination, serviceCodes: ["NOPE"], drivingDistance: "" })).toEqual({
      ok: false,
      errors: { serviceCodes: "Unknown additional service" },
    });
  });
});

describe("movingOrderItemRows", () => {
  it("is one stored line per priced line, unit price × quantity", () => {
    const quote = priceMovingOrder(catalog, { origin, destination, serviceCodes: ["SERVICE_FLYTTEVASK"], drivingDistance: "42.86" });
    if (!quote.ok) throw new Error("not ok");
    const rows = movingOrderItemRows(quote);
    expect(rows.map((r) => [r.productCode, r.optionCode, r.quantity, r.customerPriceCents])).toEqual([
      ["MOVING_BY_SIZE", "SIZE_UNDER_40", 1, 500000],
      ["MOVING_ADDITIONAL_SERVICES", "SERVICE_FLYTTEVASK", 1, 480000],
      ["MOVING_FLOOR_SURCHARGE", "FLOOR_SURCHARGE_PER_FLOOR", 3, 40000],
      ["MOVING_CARRY_SURCHARGE", "CARRY_WITHIN_50M", 1, 50000],
      ["MOVING_DISTANCE", "KM_FROM_21", 43, 2890],
    ]);
    expect(rows.every((r) => r.cardId === 0 && r.itemType === "product")).toBe(true);
  });
});

describe("priceMovingOrder — the pricing snapshot's lines", () => {
  it("keeps every priced line on the snapshot, so a paid-vs-now comparison can list what changed", () => {
    const quote = priceMovingOrder(catalog, { origin, destination, serviceCodes: ["SERVICE_FLYTTEVASK"], drivingDistance: "42.86" });
    if (!quote.ok) throw new Error("not ok");
    const lines = quote.pricing.pricingSnapshot.lines;
    expect(lines.map((l) => [l.optionCode, l.quantity, l.customerLineTotal, l.subcontractorLineTotal])).toEqual([
      ["SIZE_UNDER_40", 1, 5000, 3000],
      ["SERVICE_FLYTTEVASK", 1, 4800, 2500],
      ["FLOOR_SURCHARGE_PER_FLOOR", 3, 1200, 600],
      ["CARRY_WITHIN_50M", 1, 500, 250],
      ["KM_FROM_21", 43, 1242.7, 709.93],
    ]);
    // The stored totals are still the per-line rounded ones.
    expect(quote.pricing.pricingSnapshot.customer.totalExVat).toBe(quote.pricing.priceExVat);
  });
});
