import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  priceListUpsert: vi.fn(),
  productUpsert: vi.fn(),
  productOptionUpsert: vi.fn(),
  priceListItemUpsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    priceList: { upsert: mocks.priceListUpsert },
    product: { upsert: mocks.productUpsert },
    productOption: { upsert: mocks.productOptionUpsert, findMany: async () => [], update: async () => ({}) },
    priceListItem: { upsert: mocks.priceListItemUpsert },
  },
}));

import { parsePriceListSettings } from "@/lib/products/priceListSettings";
import { seedFurnitureCatalog } from "./seedFurnitureCatalog";
import { FURNITURE_PRODUCTS } from "./furnitureCatalog";

function productCall(code: string) {
  const call = mocks.productUpsert.mock.calls.map(([arg]) => arg).find((arg) => arg.create.code === code);
  if (!call) throw new Error(`no product upsert for ${code}`);
  return call;
}

function deliveryType(code: string, key: string) {
  return productCall(code).create.deliveryTypes.find((d: { key: string }) => d.key === key);
}

describe("seedFurnitureCatalog", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.priceListUpsert.mockResolvedValue({ id: "pl-furniture" });
    mocks.productUpsert.mockResolvedValue({ id: "p" });
    mocks.productOptionUpsert.mockResolvedValue({ id: "o" });
    mocks.priceListItemUpsert.mockResolvedValue({});
  });

  it("creates the WEBSITE_FURNITURE price list, separate from white goods, with the shared order-level fees", async () => {
    const result = await seedFurnitureCatalog();

    const call = mocks.priceListUpsert.mock.calls[0][0];
    expect(call.where.code).toBe("WEBSITE_FURNITURE");
    expect(call.create.code).toBe("WEBSITE_FURNITURE");
    const settings = parsePriceListSettings(call.create.description);
    expect(settings.expressDelivery.price).toBe("515");
    expect(settings.floorSurcharge.price).toBe("70");
    expect(result.priceListId).toBe("pl-furniture");
  });

  it("seeds every product and every option, pricing them on the furniture list", async () => {
    const result = await seedFurnitureCatalog();

    const optionCount = FURNITURE_PRODUCTS.reduce((sum, p) => sum + p.options.length, 0);
    expect(result.productsUpserted).toBe(23);
    expect(result.optionsUpserted).toBe(optionCount);
    expect(mocks.priceListItemUpsert).toHaveBeenCalledTimes(optionCount);
    expect(
      mocks.priceListItemUpsert.mock.calls.every(([arg]) => arg.create.priceListId === "pl-furniture"),
    ).toBe(true);
  });

  it("rounds prices to 5 kr like the white-goods seed, so delivery + assembly still adds up", async () => {
    await seedFurnitureCatalog();

    expect(deliveryType("FN_BED", "FIRST_STEP")).toMatchObject({ price: "610", xtraPrice: "155" });
    expect(deliveryType("FN_BED", "INDOOR")).toMatchObject({ price: "690", xtraPrice: "235" });

    const assembly = mocks.priceListItemUpsert.mock.calls
      .map(([arg]) => arg)
      .find((arg) => arg.create.customerPriceCents === 85000);
    expect(assembly).toBeDefined();
    // 690 (carry-in) + 850 (assembly) = 1540, the source's 1540.408 rounded.
    expect(690 + 850).toBe(1540);
  });

  it("gives heavy products the Side-by-Side delivery price and no extra-item discount", async () => {
    await seedFurnitureCatalog();

    expect(deliveryType("FN_SOFA", "FIRST_STEP")).toMatchObject({ price: "1030", xtraPrice: "1030" });
    expect(deliveryType("FN_SOFA", "INDOOR")).toMatchObject({ price: "1340", xtraPrice: "1340" });
  });

  it("enables assembly-only exactly where the product has assembly options", async () => {
    await seedFurnitureCatalog();

    expect(deliveryType("FN_BED", "INSTALL_ONLY").enabled).toBe(true);
    expect(deliveryType("FN_MATTRESS", "INSTALL_ONLY").enabled).toBe(false);
    expect(deliveryType("FN_OTHER_FURNITURE", "INSTALL_ONLY").enabled).toBe(false);
  });

  it("never seeds the 'needs implementation' note for Other furniture as a priced option", async () => {
    await seedFurnitureCatalog();

    const labels = mocks.productOptionUpsert.mock.calls.map(([arg]) => arg.create.label as string);
    expect(labels.some((label) => /needs implementation/i.test(label))).toBe(false);
  });

  it("writes English to label + descriptionEn and Norwegian to description", async () => {
    await seedFurnitureCatalog();

    const call = mocks.productOptionUpsert.mock.calls
      .map(([arg]) => arg)
      .find((arg) => arg.create.code === "ASM_SGL_BED_IKEA");
    expect(call.create.label).toBe("Single bed — IKEA");
    expect(call.create.description).toMatch(/IKEA/);
    expect(call.create.descriptionEn).toBe("Single bed — IKEA");
    expect(call.create.category).toBe("install");
  });
});
