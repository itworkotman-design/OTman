import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  priceListUpsert: vi.fn(),
  productUpsert: vi.fn(),
  productOptionUpsert: vi.fn(),
  productOptionUpdateMany: vi.fn(),
  priceListItemUpsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    priceList: { upsert: mocks.priceListUpsert },
    product: { upsert: mocks.productUpsert },
    productOption: { upsert: mocks.productOptionUpsert, updateMany: mocks.productOptionUpdateMany },
    priceListItem: { upsert: mocks.priceListItemUpsert },
  },
}));

import { seedMovingCatalog } from "./seedMovingCatalog";
import {
  MOVING_FLOOR_SURCHARGE_OPTION,
  MOVING_FLOOR_SURCHARGE_PRODUCT_CODE,
  MOVING_PRICE_LIST_CODE,
  MOVING_PRODUCT_CODE,
  MOVING_SERVICES_PRODUCT_CODE,
  MOVING_SERVICE_OPTIONS,
  MOVING_SIZE_OPTIONS,
} from "./movingCatalog";

describe("seedMovingCatalog", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.priceListUpsert.mockResolvedValue({ id: "pl-moving" });
    mocks.productUpsert.mockImplementation(async (arg: { create: { code: string } }) => ({
      id:
        arg.create.code === MOVING_SERVICES_PRODUCT_CODE
          ? "p-services"
          : arg.create.code === MOVING_FLOOR_SURCHARGE_PRODUCT_CODE
            ? "p-floor"
            : "p-moving",
    }));
    mocks.productOptionUpsert.mockResolvedValue({ id: "o" });
    mocks.priceListItemUpsert.mockResolvedValue({});
  });

  it("creates the WEBSITE_MOVING price list", async () => {
    const result = await seedMovingCatalog();

    const call = mocks.priceListUpsert.mock.calls[0][0];
    expect(call.where.code).toBe(MOVING_PRICE_LIST_CODE);
    expect(call.create.code).toBe(MOVING_PRICE_LIST_CODE);
    expect(result.priceListId).toBe("pl-moving");
  });

  it("creates one bare product (no delivery types, install options, or extras) with the moving product code", async () => {
    await seedMovingCatalog();

    const call = mocks.productUpsert.mock.calls[0][0];
    expect(call.create.code).toBe(MOVING_PRODUCT_CODE);
    expect(call.create.allowDeliveryTypes).toBe(false);
    expect(call.create.allowInstallOptions).toBe(false);
    expect(call.create.allowExtraServices).toBe(false);
    expect(call.create.allowReturnOptions).toBe(false);
    expect(call.create.allowQuantity).toBe(false);
  });

  it("seeds one option per size bracket", async () => {
    const result = await seedMovingCatalog();

    expect(result.optionsUpserted).toBe(MOVING_SIZE_OPTIONS.length);
    const codes = mocks.productOptionUpsert.mock.calls
      .filter(([arg]) => arg.create.productId === "p-moving")
      .map(([arg]) => arg.create.code);
    expect(codes).toEqual(MOVING_SIZE_OPTIONS.map((o) => o.code));
  });

  it("seeds a separate additional-services product on the same price list, one option per service", async () => {
    const result = await seedMovingCatalog();

    const servicesProduct = mocks.productUpsert.mock.calls
      .map(([arg]) => arg)
      .find((arg) => arg.create.code === MOVING_SERVICES_PRODUCT_CODE);
    expect(servicesProduct).toBeDefined();
    expect(servicesProduct.create.allowQuantity).toBe(false);

    const serviceOptions = mocks.productOptionUpsert.mock.calls
      .map(([arg]) => arg)
      .filter((arg) => arg.create.productId === "p-services");
    expect(serviceOptions.map((arg) => arg.create.code)).toEqual(MOVING_SERVICE_OPTIONS.map((o) => o.code));
    expect(serviceOptions.every((arg) => arg.create.category === "service")).toBe(true);
    expect(result.servicesUpserted).toBe(MOVING_SERVICE_OPTIONS.length);
    // Same price list, same "never overwrite staff prices" rule as sizes.
    // + the per-floor surcharge line.
    expect(mocks.priceListItemUpsert).toHaveBeenCalledTimes(MOVING_SIZE_OPTIONS.length + MOVING_SERVICE_OPTIONS.length + 1);
  });

  it("includes Nedpakking and Flyttevask (Mellomlagring left out for now)", () => {
    expect(MOVING_SERVICE_OPTIONS.map((o) => o.labelNo)).toEqual(["Nedpakking", "Flyttevask"]);
  });

  it("sets an initial (placeholder) price only when creating a price list item, never on update", async () => {
    await seedMovingCatalog();

    for (const [arg] of mocks.priceListItemUpsert.mock.calls) {
      // The create branch may seed a starting value (0 today), but the
      // update branch must be a no-op on price fields — re-running the seed
      // (e.g. a fresh dev DB setup) must never overwrite prices a staff
      // member has since entered via the dashboard.
      expect(arg.update).toEqual({});
      expect(arg.create.priceListId).toBe("pl-moving");
    }
  });

  it("keeps the product's structural config (allow* flags) in sync on update, unlike prices", async () => {
    // Structural product fields are fine to keep in sync from code, same as
    // every other website catalog — only per-option prices are treated as
    // staff-owned data (see the price list item test above). This just
    // documents/locks that split.
    await seedMovingCatalog();

    const productCall = mocks.productUpsert.mock.calls[0][0];
    expect(productCall.update.allowDeliveryTypes).toBe(false);
    expect(productCall.update.allowQuantity).toBe(false);
    expect(productCall.update.code).toBeUndefined();
  });
});

describe("seedMovingCatalog — options removed from code", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.priceListUpsert.mockResolvedValue({ id: "pl-moving" });
    mocks.productUpsert.mockImplementation(async (arg: { create: { code: string } }) => ({
      id:
        arg.create.code === MOVING_SERVICES_PRODUCT_CODE
          ? "p-services"
          : arg.create.code === MOVING_FLOOR_SURCHARGE_PRODUCT_CODE
            ? "p-floor"
            : "p-moving",
    }));
    mocks.productOptionUpsert.mockResolvedValue({ id: "o" });
    mocks.priceListItemUpsert.mockResolvedValue({});
    mocks.productOptionUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("deactivates options no longer in the code (e.g. Mellomlagring), so a reseed hides them", async () => {
    await seedMovingCatalog();

    const servicesCall = mocks.productOptionUpdateMany.mock.calls
      .map(([arg]) => arg)
      .find((arg) => arg.where.productId === "p-services");
    expect(servicesCall).toEqual({
      where: { productId: "p-services", code: { notIn: MOVING_SERVICE_OPTIONS.map((o) => o.code) } },
      data: { isActive: false },
    });
    const sizesCall = mocks.productOptionUpdateMany.mock.calls
      .map(([arg]) => arg)
      .find((arg) => arg.where.productId === "p-moving");
    expect(sizesCall.where.code.notIn).toEqual(MOVING_SIZE_OPTIONS.map((o) => o.code));
  });

  it("re-activates an option that comes back to the code", async () => {
    await seedMovingCatalog();

    for (const [arg] of mocks.productOptionUpsert.mock.calls) {
      expect(arg.update.isActive).toBe(true);
    }
  });
});

describe("seedMovingCatalog — floor surcharge", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.priceListUpsert.mockResolvedValue({ id: "pl-moving" });
    mocks.productUpsert.mockImplementation(async (arg: { create: { code: string } }) => ({ id: `p-${arg.create.code}` }));
    mocks.productOptionUpsert.mockResolvedValue({ id: "o" });
    mocks.priceListItemUpsert.mockResolvedValue({});
    mocks.productOptionUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("seeds a per-floor surcharge line on the moving price list, for staff to price", async () => {
    await seedMovingCatalog();

    const option = mocks.productOptionUpsert.mock.calls
      .map(([arg]) => arg)
      .find((arg) => arg.create.productId === `p-${MOVING_FLOOR_SURCHARGE_PRODUCT_CODE}`);
    expect(option.create.code).toBe(MOVING_FLOOR_SURCHARGE_OPTION.code);
    expect(option.create.description).toBe("Etasjetillegg (per etasje, uten heis)");
  });
});
