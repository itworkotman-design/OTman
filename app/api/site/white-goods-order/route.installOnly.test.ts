import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membershipFindUnique: vi.fn(),
  getWebsiteOrderCatalog: vi.fn(),
}));

vi.mock("@/lib/orders/sendOrderReceivedEmail", () => ({ sendOrderReceivedEmail: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { membership: { findUnique: mocks.membershipFindUnique } },
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
  pickupPlaceName: "Elkjøp Lillestrøm",
  pickupAddress: "Storgata 1, Oslo",
  deliveryAddress: "Storgata 2, Oslo",
  name: "Test Customer",
  phone: "+47 123 45 678",
  email: "customer@example.com",
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
