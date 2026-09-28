import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  getPriceListByIdMock: vi.fn(),
  getProductConfigMapMock: vi.fn(),
  getDeliveryOnlyProductsMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));

vi.mock("@/lib/products/priceLists", () => ({
  getPriceListById: mocks.getPriceListByIdMock,
}));

vi.mock("@/lib/products/productConfig", () => ({
  getProductConfigMap: mocks.getProductConfigMapMock,
}));

vi.mock("@/lib/products/deliveryOnlyProducts", () => ({
  getDeliveryOnlyProducts: mocks.getDeliveryOnlyProductsMock,
}));

import { GET } from "./route";

function call() {
  return GET(new Request("http://localhost/api"), {
    params: Promise.resolve({ pricelistId: "pl-1" }),
  });
}

describe("GET /api/products/pricelists/[pricelistId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u-1" });
    mocks.getProductConfigMapMock.mockResolvedValue(new Map());
    mocks.getPriceListByIdMock.mockResolvedValue({
      id: "pl-1",
      name: "Website — Parcel/Pallet",
      code: "WEBSITE_PARCEL_PALLET",
      description: null,
      isActive: true,
      items: [],
      specialOptions: [],
    });
  });

  it("returns the price list's delivery-only products, which have no price-list item rows of their own", async () => {
    const product = { productId: "p-pose", productName: "Bag", productCode: "PKG_POSE" };
    mocks.getDeliveryOnlyProductsMock.mockResolvedValue([product]);

    const res = await call();
    const json = await res.json();

    expect(json.priceList.items).toEqual([]);
    expect(json.priceList.deliveryOnlyProducts).toEqual([product]);
    expect(mocks.getDeliveryOnlyProductsMock).toHaveBeenCalledWith("pl-1");
  });

  it("exposes the delivery-only setting, off for a list that never set it", async () => {
    mocks.getDeliveryOnlyProductsMock.mockResolvedValue([]);

    const json = await (await call()).json();

    expect(json.priceList.settings.deliveryOnly).toBe(false);
  });
});
