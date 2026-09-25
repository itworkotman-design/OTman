import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ priceListFindManyMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { priceList: { findMany: mocks.priceListFindManyMock } } }));

import { GET } from "./route";

const API_KEY = "test-api-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const originalApiKey = process.env.OTMAN_API_KEY;
const originalCompanyId = process.env.OTMAN_API_COMPANY_ID;

describe("GET /api/integrations/mcp/catalog/pricelists", () => {
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

  it("returns only active pricelists", async () => {
    mocks.priceListFindManyMock.mockResolvedValue([
      { id: "pl_1", name: "Standard", code: "STD" },
    ]);

    const response = await GET(
      new Request("http://localhost/api/integrations/mcp/catalog/pricelists", {
        headers: { Authorization: `Bearer ${API_KEY}`, "X-Otman-Company-Id": COMPANY_ID },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.priceListFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
    await expect(response.json()).resolves.toEqual({
      pricelists: [{ id: "pl_1", name: "Standard", code: "STD" }],
    });
  });
});
