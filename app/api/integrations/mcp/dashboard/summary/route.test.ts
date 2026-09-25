import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderCountMock: vi.fn(),
  orderGroupByMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { order: { count: mocks.orderCountMock, groupBy: mocks.orderGroupByMock } },
}));

import { GET } from "./route";

const API_KEY = "test-api-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const originalApiKey = process.env.OTMAN_API_KEY;
const originalCompanyId = process.env.OTMAN_API_COMPANY_ID;

describe("GET /api/integrations/mcp/dashboard/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OTMAN_API_KEY = API_KEY;
    process.env.OTMAN_API_COMPANY_ID = COMPANY_ID;
    mocks.orderCountMock.mockResolvedValue(3);
    mocks.orderGroupByMock.mockResolvedValue([
      { status: "confirmed", _count: { status: 3 } },
    ]);
  });

  afterAll(() => {
    if (originalApiKey === undefined) delete process.env.OTMAN_API_KEY;
    else process.env.OTMAN_API_KEY = originalApiKey;
    if (originalCompanyId === undefined) delete process.env.OTMAN_API_COMPANY_ID;
    else process.env.OTMAN_API_COMPANY_ID = originalCompanyId;
  });

  it("returns month-to-date order stats without revenue or staff leaderboards", async () => {
    const response = await GET(
      new Request("http://localhost/api/integrations/mcp/dashboard/summary", {
        headers: { Authorization: `Bearer ${API_KEY}`, "X-Otman-Company-Id": COMPANY_ID },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.summary).toMatchObject({
      ordersThisMonth: 3,
      statusBreakdown: [{ status: "confirmed", count: 3 }],
    });
    expect(body.summary).not.toHaveProperty("storeLeaderboard");
    expect(body.summary).not.toHaveProperty("totalIncome");
  });
});
