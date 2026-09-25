import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countOrdersInDeliverySlotMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/orders/capacity", async () => {
  const actual = await vi.importActual<typeof import("@/lib/orders/capacity")>(
    "@/lib/orders/capacity",
  );
  return {
    ...actual,
    countOrdersInDeliverySlot: mocks.countOrdersInDeliverySlotMock,
  };
});

import { GET } from "./route";

const API_KEY = "test-api-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const originalApiKey = process.env.OTMAN_API_KEY;
const originalCompanyId = process.env.OTMAN_API_COMPANY_ID;

function createRequest(query: string) {
  return GET(
    new Request(`http://localhost/api/integrations/mcp/orders/capacity${query}`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "X-Otman-Company-Id": COMPANY_ID,
      },
    }),
  );
}

describe("GET /api/integrations/mcp/orders/capacity", () => {
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

  it("rejects a request without a valid API key", async () => {
    const response = await GET(
      new Request("http://localhost/api/integrations/mcp/orders/capacity?deliveryDate=2026-10-01&timeWindow=10:00-12:00", {
        headers: { Authorization: "Bearer wrong", "X-Otman-Company-Id": COMPANY_ID },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("requires deliveryDate and timeWindow", async () => {
    const response = await createRequest("");
    expect(response.status).toBe(400);
    expect(mocks.countOrdersInDeliverySlotMock).not.toHaveBeenCalled();
  });

  it("returns capacity for the requested slot", async () => {
    mocks.countOrdersInDeliverySlotMock.mockResolvedValue(16);

    const response = await createRequest("?deliveryDate=2026-10-01&timeWindow=10:00-12:00");

    expect(response.status).toBe(200);
    expect(mocks.countOrdersInDeliverySlotMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        companyId: COMPANY_ID,
        deliveryDate: "2026-10-01",
        timeWindow: "10:00-12:00",
      }),
    );
    await expect(response.json()).resolves.toEqual({
      capacity: {
        deliveryDate: "2026-10-01",
        timeWindow: "10:00-12:00",
        count: 16,
        limit: 15,
        hardLimit: 20,
        isOverCapacity: true,
        isHardLimitReached: false,
      },
    });
  });
});
