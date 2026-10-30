import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  priceListFindUniqueMock: vi.fn(),
  productFindManyMock: vi.fn(),
  itemFindManyMock: vi.fn(),
  specialFindManyMock: vi.fn(),
  getProductConfigMapMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    priceList: { findUnique: mocks.priceListFindUniqueMock },
    product: { findMany: mocks.productFindManyMock },
    priceListItem: { findMany: mocks.itemFindManyMock },
    priceListSpecialOption: { findMany: mocks.specialFindManyMock },
  },
}));

vi.mock("@/lib/products/productConfig", () => ({
  getProductConfigMap: mocks.getProductConfigMapMock,
}));

import { getBookingCatalog } from "./getBookingCatalog";

describe("getBookingCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.priceListFindUniqueMock.mockResolvedValue({ description: null });
    mocks.productFindManyMock.mockResolvedValue([
      { id: "p-fridge", code: "FRIDGE", name: "Kjøleskap", isActive: true, options: [] },
    ]);
    mocks.itemFindManyMock.mockResolvedValue([]);
    mocks.specialFindManyMock.mockResolvedValue([]);
    mocks.getProductConfigMapMock.mockResolvedValue(
      new Map([
        [
          "p-fridge",
          {
            id: "p-fridge",
            deliveryTypes: [{ key: "INDOOR", price: "552" }],
            customSections: [],
            autoDeliveryPrice: { price: "0" },
          },
        ],
      ]),
    );
  });

  it("prices delivery types from the requested price list", async () => {
    const catalog = await getBookingCatalog("list-business");

    expect(mocks.getProductConfigMapMock).toHaveBeenCalledWith(["p-fridge"], "list-business");
    expect(catalog.products[0]?.deliveryTypes[0]?.price).toBe("552");
  });
});
