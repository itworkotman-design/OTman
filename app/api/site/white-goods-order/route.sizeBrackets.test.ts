import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membershipFindUnique: vi.fn(),
  getWebsiteOrderCatalog: vi.fn(),
}));

vi.mock("@/lib/customerAccounts/welcomeWebsiteOrderCustomer", () => ({ welcomeWebsiteOrderCustomer: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { membership: { findUnique: mocks.membershipFindUnique } },
}));
vi.mock("@/lib/content/websiteOrderCatalog", () => ({
  getWebsiteOrderCatalog: mocks.getWebsiteOrderCatalog,
}));

function option(id: string, category: string, code = id.toUpperCase()) {
  return {
    id,
    code,
    label: id,
    description: id,
    category,
    customerPrice: "0",
    subcontractorPrice: "0",
    effectiveCustomerPrice: "0",
    active: true,
  };
}

const catalogProducts = [
  {
    id: "other-furniture",
    code: "FN_OTHER_FURNITURE",
    label: "Other furniture",
    active: true,
    options: [
      option("vol-1", "size_volume", "OF_VOL_1"),
      option("vol-3", "size_volume", "OF_VOL_3"),
      option("wt-1", "size_weight", "OF_WT_1"),
      option("wt-2", "size_weight", "OF_WT_2"),
    ],
  },
];

async function post(body: unknown) {
  vi.resetModules();
  const { POST } = await import("./route");
  return POST(new Request("http://localhost/api/site/white-goods-order", { method: "POST", body: JSON.stringify(body) }));
}

const baseCard = {
  cardId: 0,
  productId: "other-furniture",
  deliveryType: "firstStep",
  amount: 1,
  selectedInstallOptionIds: [],
  modelNumber: "Grandfather clock",
};
const DIMENSIONS = { widthCm: 100, heightCm: 50, lengthCm: 50 };
const validBody = {
  pickupSource: "store",
  pickupPlaceName: "Elkjøp Lillestrøm",
  pickupAddress: "Storgata 1, Oslo",
  deliveryAddress: "Storgata 2, Oslo",
  name: "Test Customer",
  phone: "+47 123 45 678",
  email: "customer@example.com",
};

describe("POST /api/site/white-goods-order — size brackets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WEBSITE_MEMBERSHIP_ID = "m1";
    mocks.membershipFindUnique.mockResolvedValue({ id: "m1", companyId: "c1", status: "ACTIVE" });
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ priceListId: "pl", products: catalogProducts, specialOptions: [], priceListSettings: {} });
  });

  it("rejects an Other-furniture card with no volume/weight chosen — the surcharge can't be dodged by skipping the selectors", async () => {
    const res = await post({ ...validBody, productCards: [{ ...baseCard, selectedExtraOptionIds: [] }] });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.reason).toBe("VALIDATION_FAILED");
    expect(json.errors.productCards).toMatch(/volume|weight/i);
  });

  it("rejects a card with only a weight — the volume comes from the dimensions", async () => {
    const res = await post({ ...validBody, productCards: [{ ...baseCard, selectedExtraOptionIds: ["wt-1"] }] });

    expect(res.status).toBe(422);
  });

  it("does not trust a volume bracket sent without dimensions (a way to dodge the volume charge)", async () => {
    const res = await post({ ...validBody, productCards: [{ ...baseCard, selectedExtraOptionIds: ["vol-1", "wt-1"] }] });

    expect(res.status).toBe(422);
  });

  it("rejects dimensions that aren't one of the preset choices", async () => {
    const res = await post({
      ...validBody,
      productCards: [{ ...baseCard, sizeDimensionsCm: { widthCm: 7, heightCm: 50, lengthCm: 50 }, selectedExtraOptionIds: ["wt-1"] }],
    });

    expect(res.status).toBe(422);
  });

  it("rejects an item larger than the top volume bracket (needs a manual quote)", async () => {
    const res = await post({
      ...validBody,
      productCards: [{ ...baseCard, sizeDimensionsCm: { widthCm: 250, heightCm: 250, lengthCm: 250 }, selectedExtraOptionIds: ["wt-1"] }],
    });

    expect(res.status).toBe(422);
  });

  it("rejects two weight brackets", async () => {
    const res = await post({
      ...validBody,
      productCards: [{ ...baseCard, sizeDimensionsCm: { widthCm: 100, heightCm: 50, lengthCm: 50 }, selectedExtraOptionIds: ["wt-1", "wt-2"] }],
    });

    expect(res.status).toBe(422);
  });

  it("rejects an Other-furniture card with no name — staff and drivers need to know what the item is", async () => {
    for (const modelNumber of ["", "   ", undefined]) {
      const res = await post({
        ...validBody,
        productCards: [{ ...baseCard, modelNumber, sizeDimensionsCm: DIMENSIONS, selectedExtraOptionIds: ["wt-1"] }],
      });

      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.errors.productCards).toMatch(/what the item is|name/i);
    }
  });

  it("rejects a name that is too long or contains disallowed characters", async () => {
    for (const modelNumber of ["x".repeat(81), "<script>alert(1)</script>", 'a "quoted" name']) {
      const res = await post({
        ...validBody,
        productCards: [{ ...baseCard, modelNumber, sizeDimensionsCm: DIMENSIONS, selectedExtraOptionIds: ["wt-1"] }],
      });

      expect(res.status).toBe(422);
    }
  });

  it("lets a complete selection past the size check (later pipeline steps aren't mocked, so it must not be a 422)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post({ ...validBody, productCards: [{ ...baseCard, sizeDimensionsCm: DIMENSIONS, selectedExtraOptionIds: ["wt-2"] }] });

    expect(res.status).not.toBe(422);
  });
});
