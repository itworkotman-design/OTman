import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  linkFindManyMock: vi.fn(),
  getProductConfigMapMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { priceListProduct: { findMany: mocks.linkFindManyMock } },
}));

vi.mock("@/lib/products/productConfig", () => ({
  getProductConfigMap: mocks.getProductConfigMapMock,
}));

import { getDeliveryOnlyProducts } from "./deliveryOnlyProducts";

const CONFIG = {
  productType: "PHYSICAL",
  allowDeliveryTypes: true,
  allowInstallOptions: false,
  allowReturnOptions: false,
  allowExtraServices: false,
  allowDemont: false,
  allowQuantity: true,
  allowPeopleCount: false,
  allowHoursInput: false,
  allowModelNumber: true,
  autoXtraPerPallet: false,
  autoDeliveryPrice: { enabled: false },
  deliveryTypes: [{ key: "FIRST_STEP", price: "0" }],
  customSections: [],
};

describe("getDeliveryOnlyProducts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the products linked to the price list, in product sort order, with their config", async () => {
    mocks.linkFindManyMock.mockResolvedValue([
      { product: { id: "p-pose", name: "Bag", code: "PKG_POSE" } },
    ]);
    mocks.getProductConfigMapMock.mockResolvedValue(new Map([["p-pose", { id: "p-pose", ...CONFIG }]]));

    const result = await getDeliveryOnlyProducts("pl-1");

    const args = mocks.linkFindManyMock.mock.calls[0][0];
    expect(args.where).toEqual({ priceListId: "pl-1" });
    expect(args.orderBy).toEqual({ product: { sortOrder: "asc" } });
    expect(result).toEqual([
      expect.objectContaining({
        productId: "p-pose",
        productName: "Bag",
        productCode: "PKG_POSE",
        productType: "PHYSICAL",
        deliveryTypes: CONFIG.deliveryTypes,
      }),
    ]);
    // The config row's own id is folded into productId, not leaked alongside it.
    expect(result[0]).not.toHaveProperty("id");
  });

  it("skips a linked product whose config row can't be loaded", async () => {
    mocks.linkFindManyMock.mockResolvedValue([
      { product: { id: "p-gone", name: "Gone", code: "PKG_GONE" } },
    ]);
    mocks.getProductConfigMapMock.mockResolvedValue(new Map());

    expect(await getDeliveryOnlyProducts("pl-1")).toEqual([]);
  });

  it("returns an empty list without loading configs when nothing is linked", async () => {
    mocks.linkFindManyMock.mockResolvedValue([]);
    mocks.getProductConfigMapMock.mockResolvedValue(new Map());

    expect(await getDeliveryOnlyProducts("pl-1")).toEqual([]);
  });
});
