import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  priceListFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { priceList: { findUnique: mocks.priceListFindUniqueMock } },
}));

import { findMovingSizeOption, getMovingCatalog } from "./getMovingCatalog";

describe("getMovingCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the moving price list hasn't been seeded", async () => {
    mocks.priceListFindUniqueMock.mockResolvedValue(null);

    await expect(getMovingCatalog()).resolves.toBeNull();
  });

  it("maps active options, sorted by sortOrder, with their prices", async () => {
    mocks.priceListFindUniqueMock.mockResolvedValue({
      id: "pl-moving",
      items: [
        {
          customerPriceCents: 1400000,
          subcontractorPriceCents: 900000,
          productOption: { code: "SIZE_UNDER_40", label: "Under 40 m²", description: "Under 40 m²", sortOrder: 2, isActive: true },
        },
        {
          customerPriceCents: 800000,
          subcontractorPriceCents: 500000,
          productOption: { code: "SIZE_UNDER_20", label: "Under 20 m²", description: "Under 20 m²", sortOrder: 1, isActive: true },
        },
      ],
    });

    const result = await getMovingCatalog();

    expect(result?.priceListId).toBe("pl-moving");
    expect(result?.options.map((o) => o.code)).toEqual(["SIZE_UNDER_20", "SIZE_UNDER_40"]);
    expect(result?.options[0]).toEqual({
      code: "SIZE_UNDER_20",
      labelEn: "Under 20 m²",
      labelNo: "Under 20 m²",
      customerPriceCents: 800000,
      subcontractorPriceCents: 500000,
    });
  });

  it("excludes inactive options", async () => {
    mocks.priceListFindUniqueMock.mockResolvedValue({
      id: "pl-moving",
      items: [
        {
          customerPriceCents: 800000,
          subcontractorPriceCents: 500000,
          productOption: { code: "SIZE_UNDER_20", label: "Under 20 m²", description: "Under 20 m²", sortOrder: 1, isActive: false },
        },
      ],
    });

    const result = await getMovingCatalog();

    expect(result?.options).toEqual([]);
  });
});

describe("findMovingSizeOption", () => {
  const options = [
    { code: "SIZE_UNDER_20", labelEn: "Under 20 m²", labelNo: "Under 20 m²", customerPriceCents: 800000, subcontractorPriceCents: 500000 },
    { code: "SIZE_UNDER_40", labelEn: "Under 40 m²", labelNo: "Under 40 m²", customerPriceCents: 1400000, subcontractorPriceCents: 900000 },
  ];

  it("finds the option matching the given code", () => {
    expect(findMovingSizeOption(options, "SIZE_UNDER_40")?.customerPriceCents).toBe(1400000);
  });

  it("returns null for an unknown code", () => {
    expect(findMovingSizeOption(options, "NOT_A_REAL_CODE")).toBeNull();
  });

  it("returns null for a missing code", () => {
    expect(findMovingSizeOption(options, null)).toBeNull();
    expect(findMovingSizeOption(options, undefined)).toBeNull();
    expect(findMovingSizeOption(options, "")).toBeNull();
  });
});
