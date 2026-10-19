import { describe, expect, it, vi } from "vitest";

// getMovingCatalog.ts (the size/service lookups) imports the DB client.
vi.mock("@/lib/db", () => ({ prisma: {} }));

import type { MovingCatalog } from "@/lib/content/getMovingCatalog";
import { findForbiddenChanges } from "./customerOrderEditPolicy";
import {
  classifyMovingEdit,
  movingEditFromOrder,
  movingOrderSaveData,
  parseMovingEdit,
  type MovingEdit,
} from "./movingOrderEdit";
import { priceMovingOrder } from "./movingOrderQuote";

const apartment = { homeType: "APARTMENT", sizeOptionCode: "SIZE_UNDER_40", floors: 1, floorNumber: 4, hasLift: true, parking: "OUTSIDE" } as const;
const house = { homeType: "DETACHED", sizeOptionCode: "SIZE_UNDER_40", floors: 2, floorNumber: null, hasLift: null, parking: "OUTSIDE" } as const;

const stored = {
  pickupAddress: "Karl Johans gate 1, 0154 Oslo",
  deliveryAddress: "Bragernes torg 1, 3017 Drammen",
  websiteBookingDetails: { version: 1, customerType: "private", origin: apartment, destination: house, serviceCodes: ["SERVICE_NEDPAKKING"] },
};

const edit: MovingEdit = {
  pickupAddress: stored.pickupAddress,
  deliveryAddress: stored.deliveryAddress,
  origin: { ...apartment },
  destination: { ...house },
  serviceCodes: ["SERVICE_NEDPAKKING"],
};

describe("movingEditFromOrder", () => {
  it("reads the move back from a MOVING order: addresses from the columns, the rest from the stored answers", () => {
    expect(movingEditFromOrder(stored)).toEqual(edit);
  });

  it("is null for an order without stored moving answers (booked before they were kept)", () => {
    expect(movingEditFromOrder({ ...stored, websiteBookingDetails: null })).toBeNull();
  });
});

describe("parseMovingEdit", () => {
  it("validates both ends with the booking route's parser", () => {
    const parsed = parseMovingEdit(edit);
    expect(parsed.ok).toBe(true);
    expect(parseMovingEdit({ ...edit, origin: { ...apartment, hasLift: null } })).toMatchObject({
      ok: false,
      errors: { "origin.hasLift": "Required" },
    });
  });

  it("requires both addresses", () => {
    expect(parseMovingEdit({ ...edit, deliveryAddress: " " })).toMatchObject({ ok: false, errors: { deliveryAddress: "Required" } });
  });

  it("keeps service codes as a list of distinct strings", () => {
    expect(parseMovingEdit({ ...edit, serviceCodes: "x" })).toMatchObject({ ok: false, errors: { serviceCodes: "Invalid" } });
  });
});

describe("classifyMovingEdit — the same change kinds as a delivery order", () => {
  it("sees nothing for an unchanged move", () => {
    expect(classifyMovingEdit(edit, { ...edit })).toEqual([]);
  });

  it("a moved address is an address change", () => {
    expect(classifyMovingEdit(edit, { ...edit, deliveryAddress: "Storgata 1, Oslo" })).toEqual(["addresses"]);
  });

  it("anything about either end (size, floors, lift, parking) is a reconfiguration", () => {
    expect(classifyMovingEdit(edit, { ...edit, origin: { ...apartment, hasLift: false } })).toEqual(["reconfigure"]);
    expect(classifyMovingEdit(edit, { ...edit, destination: { ...house, parking: "FURTHER" } })).toEqual(["reconfigure"]);
  });

  it("only adding services is an add-on; removing one is a reconfiguration", () => {
    expect(classifyMovingEdit(edit, { ...edit, serviceCodes: ["SERVICE_NEDPAKKING", "SERVICE_FLYTTEVASK"] })).toEqual(["addOns"]);
    expect(classifyMovingEdit(edit, { ...edit, serviceCodes: [] })).toEqual(["reconfigure"]);
  });

  it("so within 24h of the job a customer may only add services", () => {
    const late = { open: true, beforeCutoff: false, cutoffAt: new Date(), canEditItems: true, editableAfterCutoff: true };
    const added = classifyMovingEdit(edit, { ...edit, serviceCodes: ["SERVICE_NEDPAKKING", "SERVICE_FLYTTEVASK"] });
    expect(findForbiddenChanges(added, late)).toEqual([]);
    const moved = classifyMovingEdit(edit, { ...edit, pickupAddress: "Storgata 1, Oslo", serviceCodes: [] });
    expect(findForbiddenChanges(moved, late)).toEqual(["addresses", "reconfigure"]);
  });
});

describe("movingOrderSaveData", () => {
  const opt = (code: string, labelEn: string, customerPriceCents: number) => ({ code, labelEn, labelNo: labelEn, customerPriceCents, subcontractorPriceCents: 0 });
  const catalog: MovingCatalog = {
    priceListId: "pl",
    options: [opt("SIZE_UNDER_40", "Under 40 m²", 500000)],
    services: [opt("SERVICE_NEDPAKKING", "Packing", 400000)],
    floorSurcharge: null,
    carrySurcharges: [],
    distanceRates: { kmFrom21: opt("KM_FROM_21", "Per km", 2890), kmOver100: opt("KM_OVER_100", "Per km", 2890) },
  };

  it("is everything a save writes: addresses, distance, price, description, summary, the answers and the lines", () => {
    const parsed = parseMovingEdit(edit);
    if (!parsed.ok) throw new Error("not ok");
    const quote = priceMovingOrder(catalog, { ...parsed, serviceCodes: edit.serviceCodes, drivingDistance: "42.86" });
    if (!quote.ok) throw new Error("not ok");
    const save = movingOrderSaveData({ quote, parsed, drivingDistance: "42.86", notes: "Piano", customerType: "private" });

    expect(save.orderData).toMatchObject({
      pickupAddress: stored.pickupAddress,
      deliveryAddress: stored.deliveryAddress,
      drivingDistance: "42.86",
      priceExVat: 5000 + 4000 + Math.round((2890 * 43) / 100),
      productsSummary: quote.summary,
      websiteBookingDetails: { version: 1, customerType: "private", serviceCodes: ["SERVICE_NEDPAKKING"] },
    });
    expect(save.orderData.description).toContain("Moving from: Apartment, Under 40 m²");
    expect(save.orderData.description).toContain("Piano");
    expect(save.itemRows.map((r) => r.optionCode)).toEqual(["SIZE_UNDER_40", "SERVICE_NEDPAKKING", "KM_FROM_21"]);
  });

  it("keeps the order's discount and extra on the re-priced move", () => {
    const parsed = parseMovingEdit(edit);
    if (!parsed.ok) throw new Error("not ok");
    const quote = priceMovingOrder(catalog, { ...parsed, serviceCodes: edit.serviceCodes, drivingDistance: "" });
    if (!quote.ok) throw new Error("not ok");
    const save = movingOrderSaveData({
      quote,
      parsed,
      drivingDistance: "",
      notes: null,
      customerType: "private",
      adjustments: { rabatt: "1000", leggTil: "250", subcontractorMinus: null, subcontractorPlus: null },
    });
    expect(save.orderData.priceExVat).toBe(9000 - 1000 + 250);
    expect(save.orderData.pricingSnapshot).toMatchObject({ customer: { discount: 1000, extra: 250, totalExVat: 8250 } });
  });
});
