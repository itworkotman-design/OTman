import { describe, expect, it } from "vitest";
import { movingSummary } from "./movingSummary";

const size = { code: "SIZE_UNDER_40", labelEn: "Under 40 m²", labelNo: "Under 40 m²", customerPriceCents: 499000, subcontractorPriceCents: 0 };
const packing = { code: "SERVICE_NEDPAKKING", labelEn: "Packing", labelNo: "Nedpakking", customerPriceCents: 150000, subcontractorPriceCents: 0 };

describe("movingSummary", () => {
  it("is empty until a size is picked, so the card shows its 'choose…' hint", () => {
    expect(movingSummary({ locale: "no", sizeOption: null, services: [packing], floorLines: [] })).toEqual({
      products: [],
      orderExtras: [],
    });
  });

  it("shows the move as one product: the size line, then each service (prices ex. VAT, in kroner)", () => {
    const { products } = movingSummary({ locale: "no", sizeOption: size, services: [packing], floorLines: [] });
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({ name: "Flytting", subtitle: "Under 40 m²", qty: 1, total: 4990 + 1500 });
    expect(products[0].lines).toEqual([
      { label: "Under 40 m²", price: 4990, qty: 1, category: "delivery" },
      { label: "Nedpakking", price: 1500, qty: 1, category: "other" },
    ]);
  });

  it("lists the no-lift floor surcharge as an order extra per end", () => {
    const { orderExtras } = movingSummary({
      locale: "no",
      sizeOption: size,
      services: [],
      floorLines: [{ end: "fra", quantity: 2, customerPriceCents: 60000 }],
    });
    expect(orderExtras).toEqual([{ label: "Etasjetillegg, fra", price: 600, qty: 2 }]);
  });

  it("speaks English on the English site", () => {
    const { products, orderExtras } = movingSummary({
      locale: "en",
      sizeOption: size,
      services: [packing],
      floorLines: [{ end: "to", quantity: 1, customerPriceCents: 30000 }],
    });
    expect(products[0].name).toBe("Moving");
    expect(products[0].lines[1].label).toBe("Packing");
    expect(orderExtras[0].label).toBe("Floor surcharge, to");
  });
});

describe("movingSummary — carrying distance", () => {
  it("lists each end's carrying-distance surcharge under order extras", () => {
    const { orderExtras } = movingSummary({
      locale: "no",
      sizeOption: size,
      services: [],
      floorLines: [],
      carryLines: [{ end: "til", labelNo: "Bæreavstand: lenger unna", labelEn: "Carrying distance: further away", customerPriceCents: 150000 }],
    });
    expect(orderExtras).toEqual([{ label: "Bæreavstand: lenger unna, til", price: 1500, qty: 1 }]);
  });
});

describe("movingSummary — distance", () => {
  it("lists the km charge under order extras with the distance", () => {
    const { orderExtras } = movingSummary({
      locale: "no",
      sizeOption: size,
      services: [],
      floorLines: [],
      distanceLines: [{ quantity: 35, customerPriceCents: 101150 }],
    });
    expect(orderExtras).toEqual([{ label: "Kjøring (35 km)", price: 1012, qty: 35 }]);
  });

  it("speaks English on the English site", () => {
    const { orderExtras } = movingSummary({
      locale: "en",
      sizeOption: size,
      services: [],
      floorLines: [],
      distanceLines: [{ quantity: 130, customerPriceCents: 325000 }],
    });
    expect(orderExtras[0].label).toBe("Distance (130 km)");
  });
});
