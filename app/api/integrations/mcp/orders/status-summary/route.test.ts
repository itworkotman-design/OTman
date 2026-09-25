import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ orderGroupByMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { order: { groupBy: mocks.orderGroupByMock } } }));

import { GET } from "./route";

const API_KEY = "test-api-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const originalApiKey = process.env.OTMAN_API_KEY;
const originalCompanyId = process.env.OTMAN_API_COMPANY_ID;

function createRequest(query: string) {
  return GET(
    new Request(`http://localhost/api/integrations/mcp/orders/status-summary${query}`, {
      headers: { Authorization: `Bearer ${API_KEY}`, "X-Otman-Company-Id": COMPANY_ID },
    }),
  );
}

describe("GET /api/integrations/mcp/orders/status-summary", () => {
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

  it("rejects a missing date", async () => {
    const response = await createRequest("");
    expect(response.status).toBe(400);
  });

  it("rejects a malformed date", async () => {
    const response = await createRequest("?date=10-01-2026");
    expect(response.status).toBe(400);
  });

  it("returns counts by status for the requested date", async () => {
    mocks.orderGroupByMock.mockResolvedValue([
      { status: "bekreftet", _count: { status: 12 } },
      { status: "kanselert", _count: { status: 2 } },
    ]);

    const response = await createRequest("?date=2026-09-25");

    expect(response.status).toBe(200);
    expect(mocks.orderGroupByMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: COMPANY_ID, deliveryDate: "2026-09-25" },
        by: ["status"],
      }),
    );
    await expect(response.json()).resolves.toEqual({
      summary: {
        date: "2026-09-25",
        total: 14,
        statusBreakdown: [
          { status: "confirmed", count: 12 },
          { status: "cancelled", count: 2 },
        ],
      },
    });
  });
});
