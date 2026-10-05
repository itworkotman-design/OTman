import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  priceListUpsert: vi.fn(),
  productUpsert: vi.fn(),
  productOptionFindMany: vi.fn(),
  productOptionUpdate: vi.fn(),
  productOptionUpsert: vi.fn(),
  priceListItemUpsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    priceList: { upsert: mocks.priceListUpsert },
    product: { upsert: mocks.productUpsert },
    productOption: {
      findMany: mocks.productOptionFindMany,
      update: mocks.productOptionUpdate,
      upsert: mocks.productOptionUpsert,
    },
    priceListItem: { upsert: mocks.priceListItemUpsert },
  },
}));

import { seedWebsiteCatalog } from "./seedWebsiteCatalog";
import type { WhiteGoodsProductSeed } from "./whiteGoodsElectronics";

const product = {
  code: "FN_CHEST_OF_DRAWERS",
  nameEn: "Chest of drawers",
  nameNo: "Kommode",
  sortOrder: 1,
  deliveryTypes: {
    firstStep: { customerPrice: 100, subcontractorPrice: 50, xtraPrice: 10, xtraSubcontractorPrice: 5 },
    indoor: { customerPrice: 120, subcontractorPrice: 60, xtraPrice: 12, xtraSubcontractorPrice: 6 },
    installOnlyEnabled: false,
  },
  options: [
    { code: "DISMANTLE_CAR_LG_7_DRW", category: "extra", labelEn: "Careful", labelNo: "Forsiktig", customerPrice: 100, subcontractorPrice: 50 },
    { code: "UNPACKING", category: "extra", labelEn: "Unpacking", labelNo: "Utpakking", customerPrice: 100, subcontractorPrice: 50 },
  ],
} as unknown as WhiteGoodsProductSeed;

async function seed() {
  await seedWebsiteCatalog({ priceListCode: "WEBSITE_FURNITURE", priceListName: "Furniture", products: [product] });
}

describe("seedWebsiteCatalog — shortened option codes", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.priceListUpsert.mockResolvedValue({ id: "pl" });
    mocks.productUpsert.mockResolvedValue({ id: "p1" });
    mocks.productOptionUpsert.mockResolvedValue({ id: "o" });
    mocks.priceListItemUpsert.mockResolvedValue({});
    mocks.productOptionUpdate.mockResolvedValue({});
  });

  it("renames an option stored under its old long code in place, so orders and prices keep pointing at it", async () => {
    mocks.productOptionFindMany.mockResolvedValue([
      { id: "o-old", code: "DISMANTLE_CAREFUL_LARGE_7_DRAWERS" },
      { id: "o-unpack", code: "UNPACKING" },
    ]);
    await seed();

    expect(mocks.productOptionFindMany).toHaveBeenCalledWith({ where: { productId: "p1" }, select: { id: true, code: true } });
    expect(mocks.productOptionUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.productOptionUpdate).toHaveBeenCalledWith({ where: { id: "o-old" }, data: { code: "DISMANTLE_CAR_LG_7_DRW" } });
    // Renamed before the upsert, which then finds and updates that same row.
    expect(mocks.productOptionUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.productOptionUpsert.mock.invocationCallOrder[0]!,
    );
  });

  it("leaves an old option alone when the short code already exists (never two rows with one code)", async () => {
    mocks.productOptionFindMany.mockResolvedValue([
      { id: "o-old", code: "DISMANTLE_CAREFUL_LARGE_7_DRAWERS" },
      { id: "o-new", code: "DISMANTLE_CAR_LG_7_DRW" },
    ]);
    await seed();
    expect(mocks.productOptionUpdate).not.toHaveBeenCalled();
  });

  it("doesn't touch options that aren't in the seed", async () => {
    mocks.productOptionFindMany.mockResolvedValue([{ id: "o-x", code: "SOMETHING_STANDARD_STAFF_ADDED" }]);
    await seed();
    expect(mocks.productOptionUpdate).not.toHaveBeenCalled();
  });
});
