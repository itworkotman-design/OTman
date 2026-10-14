import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  priceListFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { priceList: { findUnique: mocks.priceListFindUniqueMock } },
}));

import { findMovingServiceOptions, findMovingSizeOption, getMovingCatalog } from "./getMovingCatalog";
import { MOVING_SERVICES_PRODUCT_CODE } from "./movingCatalog";

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

describe("getMovingCatalog — additional services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("splits additional-service options out of the size options", async () => {
    mocks.priceListFindUniqueMock.mockResolvedValue({
      id: "pl-moving",
      items: [
        {
          customerPriceCents: 800000,
          subcontractorPriceCents: 500000,
          productOption: {
            code: "SIZE_UNDER_20",
            label: "Under 20 m²",
            description: "Under 20 m²",
            sortOrder: 1,
            isActive: true,
            product: { code: "MOVING_BY_SIZE" },
          },
        },
        {
          customerPriceCents: 150000,
          subcontractorPriceCents: 100000,
          productOption: {
            code: "SERVICE_FLYTTEVASK",
            label: "Move-out cleaning",
            description: "Flyttevask",
            sortOrder: 2,
            isActive: true,
            product: { code: MOVING_SERVICES_PRODUCT_CODE },
          },
        },
      ],
    });

    const result = await getMovingCatalog();

    expect(result?.options.map((o) => o.code)).toEqual(["SIZE_UNDER_20"]);
    expect(result?.services).toEqual([
      {
        code: "SERVICE_FLYTTEVASK",
        labelEn: "Move-out cleaning",
        labelNo: "Flyttevask",
        customerPriceCents: 150000,
        subcontractorPriceCents: 100000,
      },
    ]);
  });
});

describe("findMovingServiceOptions", () => {
  const services = [
    { code: "SERVICE_NEDPAKKING", labelEn: "Packing", labelNo: "Nedpakking", customerPriceCents: 100000, subcontractorPriceCents: 0 },
    { code: "SERVICE_FLYTTEVASK", labelEn: "Move-out cleaning", labelNo: "Flyttevask", customerPriceCents: 150000, subcontractorPriceCents: 0 },
  ];

  it("treats a missing list as no services (older clients)", () => {
    expect(findMovingServiceOptions(services, undefined)).toEqual([]);
    expect(findMovingServiceOptions(services, null)).toEqual([]);
  });

  it("resolves known codes in catalog order", () => {
    expect(findMovingServiceOptions(services, ["SERVICE_FLYTTEVASK", "SERVICE_NEDPAKKING"])?.map((s) => s.code)).toEqual([
      "SERVICE_NEDPAKKING",
      "SERVICE_FLYTTEVASK",
    ]);
  });

  it("rejects unknown codes, duplicates and non-arrays", () => {
    expect(findMovingServiceOptions(services, ["NOPE"])).toBeNull();
    expect(findMovingServiceOptions(services, ["SERVICE_NEDPAKKING", "SERVICE_NEDPAKKING"])).toBeNull();
    expect(findMovingServiceOptions(services, "SERVICE_NEDPAKKING")).toBeNull();
    expect(findMovingServiceOptions(services, [1])).toBeNull();
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

describe("getMovingCatalog — floor surcharge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const item = (code: string, productCode: string, cents: number) => ({
    customerPriceCents: cents,
    subcontractorPriceCents: cents / 2,
    productOption: { code, label: code, description: code, sortOrder: 1, isActive: true, product: { code: productCode } },
  });

  it("returns the per-floor surcharge separately from sizes and services", async () => {
    mocks.priceListFindUniqueMock.mockResolvedValue({
      id: "pl-moving",
      items: [item("SIZE_UNDER_20", "MOVING_BY_SIZE", 800000), item("FLOOR_SURCHARGE_PER_FLOOR", "MOVING_FLOOR_SURCHARGE", 30000)],
    });

    const result = await getMovingCatalog();

    expect(result?.options.map((o) => o.code)).toEqual(["SIZE_UNDER_20"]);
    expect(result?.services).toEqual([]);
    expect(result?.floorSurcharge?.customerPriceCents).toBe(30000);
  });

  it("is null when it hasn't been seeded", async () => {
    mocks.priceListFindUniqueMock.mockResolvedValue({ id: "pl-moving", items: [item("SIZE_UNDER_20", "MOVING_BY_SIZE", 800000)] });

    expect((await getMovingCatalog())?.floorSurcharge).toBeNull();
  });
});
