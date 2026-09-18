import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getWhiteGoodsPriceListIdMock: vi.fn(),
  getBookingCatalogMock: vi.fn(),
}));

vi.mock("@/lib/content/WhiteGoodsBookingConfig", () => ({
  getWhiteGoodsPriceListId: mocks.getWhiteGoodsPriceListIdMock,
}));

vi.mock("@/lib/booking/catalog/getBookingCatalog", () => ({
  getBookingCatalog: mocks.getBookingCatalogMock,
}));

import { GET } from "./route";

describe("GET /api/site/white-goods-order/catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWhiteGoodsPriceListIdMock.mockResolvedValue("price-list-1");
  });

  it("filters out non-white-goods products, e.g. the dashboard's internal DISHWASHER", async () => {
    mocks.getBookingCatalogMock.mockResolvedValue({
      products: [
        { id: "1", code: "WG_DISHWASHER", label: "Dishwasher", options: [] },
        { id: "2", code: "DISHWASHER", label: "Dishwasher (internal)", options: [] },
        { id: "3", code: "PALLET_1", label: "Pallet", options: [] },
      ],
      specialOptions: [],
      priceListSettings: {},
    });

    const res = await GET();
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.products.map((p: { code: string }) => p.code)).toEqual(["WG_DISHWASHER"]);
  });
});
