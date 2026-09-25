import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ orderFindManyMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { order: { findMany: mocks.orderFindManyMock } } }));

import { GET } from "./route";

const API_KEY = "test-api-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const originalApiKey = process.env.OTMAN_API_KEY;
const originalCompanyId = process.env.OTMAN_API_COMPANY_ID;

function createRequest(query: string) {
  return GET(
    new Request(`http://localhost/api/integrations/mcp/finance/summary${query}`, {
      headers: { Authorization: `Bearer ${API_KEY}`, "X-Otman-Company-Id": COMPANY_ID },
    }),
  );
}

describe("GET /api/integrations/mcp/finance/summary", () => {
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

  it("rejects an invalid toDate", async () => {
    const response = await createRequest("?toDate=not-a-date");
    expect(response.status).toBe(400);
  });

  it("aggregates revenue and breaks it down by store", async () => {
    mocks.orderFindManyMock.mockResolvedValue([
      { customerLabel: "POWER Skøyen", pricingSnapshot: { customer: { totalIncVat: 1000 } } },
      { customerLabel: "POWER Skøyen", pricingSnapshot: { customer: { totalIncVat: 500 } } },
      { customerLabel: "POWER Lørenskog", pricingSnapshot: { customer: { totalIncVat: 2000 } } },
    ]);

    const response = await createRequest("?customer=POWER&fromDate=2026-01-01&toDate=2026-09-23");

    expect(response.status).toBe(200);
    expect(mocks.orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: COMPANY_ID,
          customerLabel: { contains: "POWER", mode: "insensitive" },
          deliveryDate: { gte: "2026-01-01", lte: "2026-09-23" },
        }),
      }),
    );

    const body = await response.json();
    expect(body.summary.totalRevenue).toBe(3500);
    expect(body.summary.orderCount).toBe(3);
    expect(body.summary.storeBreakdown).toEqual([
      { store: "POWER Lørenskog", revenue: 2000, orderCount: 1, averagePerOrder: 2000 },
      { store: "POWER Skøyen", revenue: 1500, orderCount: 2, averagePerOrder: 750 },
    ]);
  });

  it("treats a missing pricingSnapshot as zero revenue without throwing", async () => {
    mocks.orderFindManyMock.mockResolvedValue([
      { customerLabel: "POWER Skullerud", pricingSnapshot: null },
    ]);

    const response = await createRequest("");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.summary.totalRevenue).toBe(0);
    expect(body.summary.orderCount).toBe(1);
  });
});
