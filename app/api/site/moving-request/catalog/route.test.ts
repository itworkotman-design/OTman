import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMovingCatalogMock: vi.fn(),
}));

vi.mock("@/lib/content/getMovingCatalog", () => ({
  getMovingCatalog: mocks.getMovingCatalogMock,
}));

import { GET } from "./route";

describe("GET /api/site/moving-request/catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the size-bracket options with their prices", async () => {
    mocks.getMovingCatalogMock.mockResolvedValue({
      priceListId: "pl-moving",
      options: [
        { code: "SIZE_UNDER_20", labelEn: "Under 20 m²", labelNo: "Under 20 m²", customerPriceCents: 800000, subcontractorPriceCents: 500000 },
      ],
    });

    const res = await GET();
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.priceListId).toBe("pl-moving");
    expect(json.options).toEqual([
      { code: "SIZE_UNDER_20", labelEn: "Under 20 m²", labelNo: "Under 20 m²", customerPriceCents: 800000, subcontractorPriceCents: 500000 },
    ]);
  });

  it("returns the additional services with their prices", async () => {
    const services = [
      { code: "SERVICE_FLYTTEVASK", labelEn: "Move-out cleaning", labelNo: "Flyttevask", customerPriceCents: 250000, subcontractorPriceCents: 150000 },
    ];
    mocks.getMovingCatalogMock.mockResolvedValue({ priceListId: "pl-moving", options: [], services });

    const json = await (await GET()).json();

    expect(json.services).toEqual(services);
  });

  it("returns the no-lift per-floor surcharge", async () => {
    const floorSurcharge = { code: "FLOOR_SURCHARGE_PER_FLOOR", labelEn: "Floor surcharge", labelNo: "Etasjetillegg", customerPriceCents: 30000, subcontractorPriceCents: 20000 };
    mocks.getMovingCatalogMock.mockResolvedValue({ priceListId: "pl-moving", options: [], services: [], floorSurcharge });

    const json = await (await GET()).json();

    expect(json.floorSurcharge).toEqual(floorSurcharge);
  });

  it("returns the carrying-distance surcharges", async () => {
    const carrySurcharges = [
      { code: "CARRY_FURTHER", labelEn: "Carrying distance: further away", labelNo: "Bæreavstand: lenger unna", customerPriceCents: 150000, subcontractorPriceCents: 0 },
    ];
    mocks.getMovingCatalogMock.mockResolvedValue({ priceListId: "pl-moving", options: [], services: [], floorSurcharge: null, carrySurcharges });

    const json = await (await GET()).json();

    expect(json.carrySurcharges).toEqual(carrySurcharges);
  });

  it("returns 404 when the moving price list hasn't been seeded", async () => {
    mocks.getMovingCatalogMock.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "NOT_SEEDED" });
  });
});
