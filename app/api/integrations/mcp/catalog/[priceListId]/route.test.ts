import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ priceListFindUniqueMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { priceList: { findUnique: mocks.priceListFindUniqueMock } } }));

import { GET } from "./route";

const API_KEY = "test-api-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const originalApiKey = process.env.OTMAN_API_KEY;
const originalCompanyId = process.env.OTMAN_API_COMPANY_ID;

function createRequest(priceListId: string) {
  return GET(
    new Request(`http://localhost/api/integrations/mcp/catalog/${priceListId}`, {
      headers: { Authorization: `Bearer ${API_KEY}`, "X-Otman-Company-Id": COMPANY_ID },
    }),
    { params: Promise.resolve({ priceListId }) },
  );
}

describe("GET /api/integrations/mcp/catalog/[priceListId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OTMAN_API_KEY = API_KEY;
    process.env.OTMAN_API_COMPANY_ID = COMPANY_ID;
  });

  afterAll(() => {
    if (originalApiKey === undefined) delete process.env.OTMAN_API_KEY;
    else process.env.OTMAN_API_KEY = originalApiKey;
    if (originalCompanyId === undefined) delete process.env.OTMAN_API_COMPANY_ID;
    else process.env.OTMAN_API_COMPANY_ID = originalCompanyId;
  });

  it("returns 404 for an unknown pricelist", async () => {
    mocks.priceListFindUniqueMock.mockResolvedValue(null);

    const response = await createRequest("missing");

    expect(response.status).toBe(404);
  });

  it("returns products with effective prices, dropping internal UI config", async () => {
    mocks.priceListFindUniqueMock.mockResolvedValue({
      id: "pl_1",
      code: "STD",
      name: "Standard",
      items: [
        {
          customerPriceCents: 100000,
          discountAmountCents: null,
          discountEndsAt: null,
          productOption: {
            id: "opt_1",
            code: "OPT1",
            label: "Option 1",
            category: "main",
            isActive: true,
            product: { id: "prod_1", code: "PROD1", name: "Sofa", isActive: true },
          },
        },
      ],
      specialOptions: [
        { code: "XTRA", label: "XTRA", customerPrice: "500", isActive: true },
      ],
    });

    const response = await createRequest("pl_1");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pricelist).toEqual({
      id: "pl_1",
      code: "STD",
      name: "Standard",
      products: [
        {
          id: "prod_1",
          code: "PROD1",
          label: "Sofa",
          active: true,
          options: [
            {
              id: "opt_1",
              code: "OPT1",
              label: "Option 1",
              category: "main",
              customerPrice: "1000",
              active: true,
            },
          ],
        },
      ],
      specialOptions: [
        { code: "XTRA", label: "XTRA", customerPrice: "500", active: true },
      ],
    });
  });
});
