import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  priceListFindManyMock: vi.fn(),
  getBookingCatalogMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { priceList: { findMany: mocks.priceListFindManyMock } },
}));

vi.mock("@/lib/booking/catalog/getBookingCatalog", () => ({
  getBookingCatalog: mocks.getBookingCatalogMock,
}));

import { GET } from "./route";

const get = (query = "") =>
  GET(new Request(`http://localhost/api/site/white-goods-order/catalog${query}`));

describe("GET /api/site/white-goods-order/catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.priceListFindManyMock.mockResolvedValue([
      { id: "price-list-wg", code: "WEBSITE_WHITE_GOODS" },
      { id: "price-list-fn", code: "WEBSITE_FURNITURE" },
    ]);
    // getBookingCatalog isn't list-scoped: every call returns every product.
    mocks.getBookingCatalogMock.mockResolvedValue({
      products: [
        { id: "1", code: "WG_DISHWASHER", label: "Dishwasher", options: [] },
        { id: "2", code: "DISHWASHER", label: "Dishwasher (internal)", options: [] },
        { id: "3", code: "PALLET_1", label: "Pallet", options: [] },
        { id: "4", code: "FN_SOFA", label: "Sofa", options: [] },
      ],
      specialOptions: [],
      priceListSettings: {},
    });
  });

  it("filters out non-white-goods products, e.g. the dashboard's internal DISHWASHER", async () => {
    const res = await get();
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.priceListCode).toBe("WEBSITE_WHITE_GOODS");
    expect(json.products.map((p: { code: string }) => p.code)).toEqual(["WG_DISHWASHER"]);
  });

  it("serves the furniture list's own products on request, and none of white goods'", async () => {
    const json = await (await get("?list=WEBSITE_FURNITURE")).json();

    expect(json.priceListCode).toBe("WEBSITE_FURNITURE");
    expect(json.products.map((p: { code: string }) => p.code)).toEqual(["FN_SOFA"]);
    expect(mocks.getBookingCatalogMock).toHaveBeenCalledWith("price-list-fn");
  });

  it("reports which lists are available, in offer order, with bilingual labels", async () => {
    const json = await (await get()).json();

    expect(json.availableLists).toEqual([
      { code: "WEBSITE_WHITE_GOODS", labelEn: "White goods / electronics", labelNo: "Hvitevarer / elektronikk" },
      { code: "WEBSITE_FURNITURE", labelEn: "Furniture", labelNo: "Møbler" },
    ]);
  });

  it("only offers lists that are seeded", async () => {
    mocks.priceListFindManyMock.mockResolvedValue([{ id: "price-list-wg", code: "WEBSITE_WHITE_GOODS" }]);
    const json = await (await get()).json();

    expect(json.availableLists.map((l: { code: string }) => l.code)).toEqual(["WEBSITE_WHITE_GOODS"]);
  });

  it("always takes the order-level fees and special options from the FIRST list, even when another list is requested", async () => {
    mocks.getBookingCatalogMock.mockImplementation(async (priceListId: string) => ({
      products: [
        { id: "1", code: "WG_DISHWASHER", label: "Dishwasher", options: [] },
        { id: "4", code: "FN_SOFA", label: "Sofa", options: [] },
      ],
      specialOptions: [{ id: `special-of-${priceListId}` }],
      priceListSettings: { from: priceListId },
    }));

    const json = await (await get("?list=WEBSITE_FURNITURE")).json();

    expect(json.products.map((p: { code: string }) => p.code)).toEqual(["FN_SOFA"]);
    expect(json.priceListSettings).toEqual({ from: "price-list-wg" });
    expect(json.specialOptions).toEqual([{ id: "special-of-price-list-wg" }]);
  });

  it("returns 404 for a list that isn't a seeded website list", async () => {
    const res = await get("?list=DEFAULT");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "UNKNOWN_LIST" });
  });
});
