import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membershipFindUnique: vi.fn(),
  getWebsiteOrderCatalog: vi.fn(),
}));

vi.mock("@/lib/customerAccounts/welcomeWebsiteOrderCustomer", () => ({ welcomeWebsiteOrderCustomer: vi.fn() }));
// A store pickup needs its pickup document staged under the token.
const STAGED_PICKUP_DOCUMENT = vi.hoisted(() => ({ id: "d1", filename: "Pickup 1 - kvittering.pdf", mimeType: "application/pdf", sizeBytes: 1, storagePath: "s3://orders/kvittering.pdf" }));
vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findUnique: mocks.membershipFindUnique },
    pendingQuoteAttachment: { findMany: async () => [STAGED_PICKUP_DOCUMENT], update: async () => ({}), deleteMany: async () => ({ count: 1 }) },
    orderAttachment: { create: async () => ({}) },
  },
}));
vi.mock("@/lib/content/websiteOrderCatalog", () => ({
  getWebsiteOrderCatalog: mocks.getWebsiteOrderCatalog,
}));

// "Installation only" with no installation picked is an order for nothing —
// the client auto-selects one, and the server refuses it if it's missing.
const catalogProducts = [
  {
    id: "dw",
    code: "WG_DISHWASHER",
    label: "Dishwasher",
    active: true,
    options: [
      {
        id: "inst",
        code: "DW_INSTALL",
        label: "Install",
        description: "Install",
        category: "install",
        customerPrice: "0",
        subcontractorPrice: "0",
        effectiveCustomerPrice: "0",
        active: true,
      },
    ],
  },
];

async function post(body: unknown) {
  vi.resetModules();
  const { POST } = await import("./route");
  return POST(new Request("http://localhost/api/site/white-goods-order", { method: "POST", body: JSON.stringify(body) }));
}

const validBody = {
  pickupSource: "store",
  pickupDocumentToken: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  pickupPlaceName: "Elkjøp Lillestrøm",
  pickupAddress: "Storgata 1, Oslo",
  deliveryAddress: "Storgata 2, Oslo",
  name: "Test Customer",
  phone: "+47 123 45 678",
  email: "customer@example.com",
  preferredDate: "2030-01-08",
  timeWindow: "10:00-16:00",
};

describe("POST /api/site/white-goods-order — installation only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WEBSITE_MEMBERSHIP_ID = "m1";
    mocks.membershipFindUnique.mockResolvedValue({ id: "m1", companyId: "c1", status: "ACTIVE" });
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ priceListId: "pl", products: catalogProducts, specialOptions: [], priceListSettings: {} });
  });

  it("rejects an installation-only item with no installation picked", async () => {
    const res = await post({
      ...validBody,
      productCards: [{ cardId: 0, productId: "dw", deliveryType: "INSTALL_ONLY", amount: 1, selectedInstallOptionIds: [] }],
    });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.reason).toBe("VALIDATION_FAILED");
    expect(json.errors.productCards).toMatch(/installation/i);
  });
});
