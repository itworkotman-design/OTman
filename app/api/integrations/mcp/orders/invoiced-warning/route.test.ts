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
    new Request("http://localhost/api/integrations/mcp/orders/invoiced-warning", {
      headers: { Authorization: `Bearer ${API_KEY}`, "X-Otman-Company-Id": COMPANY_ID },
    }),
  );
}

describe("GET /api/integrations/mcp/orders/invoiced-warning", () => {
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

  it("rejects an invalid API key", async () => {
    const response = await GET(
      new Request("http://localhost/api/integrations/mcp/orders/invoiced-warning", {
        headers: { Authorization: "Bearer wrong", "X-Otman-Company-Id": COMPANY_ID },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("only returns orders whose normalized status is invoiced", async () => {
    mocks.orderFindManyMock.mockResolvedValue([
      { displayId: 1, deliveryDate: "2026-08-01", status: "fakturert", invoicedAt: new Date("2026-06-01"), gdprHold: false },
      { displayId: 2, deliveryDate: "2026-08-02", status: "paid", invoicedAt: new Date("2026-06-01"), gdprHold: false },
    ]);

    const response = await createRequest();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0]).toMatchObject({ orderNumber: 1, status: "invoiced" });
  });
});
