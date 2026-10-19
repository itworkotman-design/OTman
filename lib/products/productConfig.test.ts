import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  configFindManyMock: vi.fn(),
  configUpsertMock: vi.fn(),
  configCreateManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mocks.queryRawMock,
    priceListProductConfig: {
      findMany: mocks.configFindManyMock,
    },
  },
}));

import {
  copyPriceListProductConfigs,
  getProductConfigMap,
  savePriceListProductConfig,
} from "./productConfig";

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p-fridge",
    productType: "PHYSICAL",
    allowDeliveryTypes: true,
    allowInstallOptions: true,
    allowReturnOptions: true,
    allowExtraServices: true,
    allowDemont: true,
    allowQuantity: true,
    allowPeopleCount: false,
    allowHoursInput: false,
    allowModelNumber: true,
    autoXtraPerPallet: false,
    autoDeliveryPrice: { code: "AUTO_DELIVERY", label: "Delivery", price: "650", subcontractorPrice: "553", enabled: true },
    deliveryTypes: [{ key: "INDOOR", code: "INDOOR", label: "Innbæring", price: "690", subcontractorPrice: "464", xtraPrice: "229", enabled: true }],
    customSections: [{ id: "s1", title: "Dør", options: [{ id: "o1", code: "DORTILGLIDE", label: "Dør", price: "1000", subcontractorPrice: "850" }] }],
    ...overrides,
  };
}

const indoorPrice = (config: { deliveryTypes: Array<{ key: string; price: string }> } | undefined) =>
  config?.deliveryTypes.find((type) => type.key === "INDOOR")?.price;

describe("getProductConfigMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryRawMock.mockResolvedValue([productRow()]);
    mocks.configFindManyMock.mockResolvedValue([]);
  });

  it("uses the product's own delivery prices when no price list is given", async () => {
    const map = await getProductConfigMap(["p-fridge"], null);

    expect(indoorPrice(map.get("p-fridge"))).toBe("690");
    expect(mocks.configFindManyMock).not.toHaveBeenCalled();
  });

  it("uses the price list's own delivery prices when it has them", async () => {
    mocks.configFindManyMock.mockResolvedValue([
      {
        productId: "p-fridge",
        deliveryTypes: [{ key: "INDOOR", code: "INDOOR", label: "Innbæring", price: "552", subcontractorPrice: "371", xtraPrice: "183", enabled: true }],
        autoDeliveryPrice: { code: "AUTO_DELIVERY", label: "Delivery", price: "520", subcontractorPrice: "442", enabled: true },
        customSections: [{ id: "s1", title: "Dør", options: [{ id: "o1", code: "DORTILGLIDE", label: "Dør", price: "800", subcontractorPrice: "680" }] }],
      },
    ]);

    const map = await getProductConfigMap(["p-fridge"], "list-business");
    const config = map.get("p-fridge");

    expect(mocks.configFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { priceListId: "list-business", productId: { in: ["p-fridge"] } },
      }),
    );
    expect(indoorPrice(config)).toBe("552");
    expect(config?.autoDeliveryPrice.price).toBe("520");
    expect(config?.customSections[0]?.options[0]?.price).toBe("800");
  });

  it("falls back to the product's value for each field the price list has not set", async () => {
    mocks.configFindManyMock.mockResolvedValue([
      {
        productId: "p-fridge",
        deliveryTypes: [{ key: "INDOOR", code: "INDOOR", label: "Innbæring", price: "552", subcontractorPrice: "371", xtraPrice: "183", enabled: true }],
        autoDeliveryPrice: null,
        customSections: null,
      },
    ]);

    const config = (await getProductConfigMap(["p-fridge"], "list-business")).get("p-fridge");

    expect(indoorPrice(config)).toBe("552");
    expect(config?.autoDeliveryPrice.price).toBe("650");
    expect(config?.customSections[0]?.options[0]?.price).toBe("1000");
  });

  it("uses the product's values for products the price list has no config row for", async () => {
    const config = (await getProductConfigMap(["p-fridge"], "list-other")).get("p-fridge");

    expect(indoorPrice(config)).toBe("690");
  });
});

describe("savePriceListProductConfig", () => {
  beforeEach(() => vi.clearAllMocks());

  const db = () => ({ priceListProductConfig: { upsert: mocks.configUpsertMock } });

  it("upserts only the provided fields on the price list's own row", async () => {
    const deliveryTypes = [{ key: "INDOOR", price: "552" }];

    await savePriceListProductConfig(db() as never, {
      priceListId: "list-business",
      productId: "p-fridge",
      deliveryTypes: deliveryTypes as never,
    });

    expect(mocks.configUpsertMock).toHaveBeenCalledWith({
      where: { priceListId_productId: { priceListId: "list-business", productId: "p-fridge" } },
      create: { priceListId: "list-business", productId: "p-fridge", deliveryTypes },
      update: { deliveryTypes },
    });
  });

  it("does nothing when no delivery pricing fields are provided", async () => {
    await savePriceListProductConfig(db() as never, { priceListId: "list-business", productId: "p-fridge" });

    expect(mocks.configUpsertMock).not.toHaveBeenCalled();
  });
});

describe("copyPriceListProductConfigs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("copies every product config row from the source list to the new list", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { productId: "p-fridge", deliveryTypes: [{ key: "INDOOR" }], autoDeliveryPrice: null, customSections: [] },
    ]);

    await copyPriceListProductConfigs(
      { priceListProductConfig: { findMany, createMany: mocks.configCreateManyMock } } as never,
      { fromPriceListId: "list-source", toPriceListId: "list-new" },
    );

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { priceListId: "list-source" } }));
    expect(mocks.configCreateManyMock).toHaveBeenCalledWith({
      data: [
        { priceListId: "list-new", productId: "p-fridge", deliveryTypes: [{ key: "INDOOR" }], autoDeliveryPrice: undefined, customSections: [] },
      ],
      skipDuplicates: true,
    });
  });

  it("skips the insert when the source list has no config rows", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    await copyPriceListProductConfigs(
      { priceListProductConfig: { findMany, createMany: mocks.configCreateManyMock } } as never,
      { fromPriceListId: "list-source", toPriceListId: "list-new" },
    );

    expect(mocks.configCreateManyMock).not.toHaveBeenCalled();
  });
});
