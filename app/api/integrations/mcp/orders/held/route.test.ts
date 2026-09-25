import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ orderFindManyMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { order: { findMany: mocks.orderFindManyMock } } }));

import { GET } from "./route";

const API_KEY = "test-api-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const originalApiKey = process.env.OTMAN_API_KEY;
const originalCompanyId = process.env.OTMAN_API_COMPANY_ID;

function createRequest() {
  return GET(
    new Request("http://localhost/api/integrations/mcp/orders/held", {
      headers: { Authorization: `Bearer ${API_KEY}`, "X-Otman-Company-Id": COMPANY_ID },
    }),
  );
}

describe("GET /api/integrations/mcp/orders/held", () => {
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

  it("rejects a missing company header", async () => {
    const response = await GET(
      new Request("http://localhost/api/integrations/mcp/orders/held", {
        headers: { Authorization: `Bearer ${API_KEY}`, "X-Otman-Company-Id": "another-company" },
      }),
    );
    expect(response.status).toBe(403);
  });

  it("returns held orders scoped to the company", async () => {
    mocks.orderFindManyMock.mockResolvedValue([
      { displayId: 5, status: "bekreftet", deliveryDate: "2026-09-30", gdprHoldReason: "Legal request", gdprHoldSetAt: new Date("2026-09-01") },
    ]);

    const response = await createRequest();

    expect(response.status).toBe(200);
    expect(mocks.orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_ID, gdprHold: true } }),
    );
    const body = await response.json();
    expect(body.orders[0]).toMatchObject({ orderNumber: 5, status: "confirmed" });
  });
});
