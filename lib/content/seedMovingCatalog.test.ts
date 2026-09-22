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
    productOption: { upsert: mocks.productOptionUpsert },
    priceListItem: { upsert: mocks.priceListItemUpsert },
  },
}));

import { seedMovingCatalog } from "./seedMovingCatalog";
import { MOVING_PRICE_LIST_CODE, MOVING_PRODUCT_CODE, MOVING_SIZE_OPTIONS } from "./movingCatalog";

describe("seedMovingCatalog", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.priceListUpsert.mockResolvedValue({ id: "pl-moving" });
    mocks.productUpsert.mockResolvedValue({ id: "p-moving" });
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

    expect(mocks.productOptionUpsert).toHaveBeenCalledTimes(MOVING_SIZE_OPTIONS.length);
    expect(result.optionsUpserted).toBe(MOVING_SIZE_OPTIONS.length);
    const codes = mocks.productOptionUpsert.mock.calls.map(([arg]) => arg.create.code);
    expect(codes).toEqual(MOVING_SIZE_OPTIONS.map((o) => o.code));
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
