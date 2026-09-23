import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      findUnique: mocks.orderFindUniqueMock,
    },
  },
}));

import { GET } from "./route";

const API_KEY = "test-api-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const originalApiKey = process.env.OTMAN_API_KEY;
const originalCompanyId = process.env.OTMAN_API_COMPANY_ID;

function createRequest(
  orderNumber: string,
  apiKey = API_KEY,
  companyId = COMPANY_ID,
) {
  return GET(
    new Request(
      `http://localhost/api/integrations/mcp/orders/${orderNumber}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Otman-Company-Id": companyId,
        },
      },
    ),
    { params: Promise.resolve({ orderNumber }) },
  );
}

describe("GET /api/integrations/mcp/orders/[orderNumber]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OTMAN_API_KEY = API_KEY;
    process.env.OTMAN_API_COMPANY_ID = COMPANY_ID;
  });

  afterAll(() => {
    if (originalApiKey === undefined) {
      delete process.env.OTMAN_API_KEY;
    } else {
      process.env.OTMAN_API_KEY = originalApiKey;
    }

    if (originalCompanyId === undefined) {
      delete process.env.OTMAN_API_COMPANY_ID;
    } else {
      process.env.OTMAN_API_COMPANY_ID = originalCompanyId;
    }
  });

  it("fails closed when service authentication is not configured", async () => {
    delete process.env.OTMAN_API_KEY;

    const response = await createRequest("42");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "SERVICE_NOT_CONFIGURED",
    });
    expect(mocks.orderFindUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid service API key", async () => {
    const response = await createRequest("42", "wrong-api-key");

    expect(response.status).toBe(401);
    expect(mocks.orderFindUniqueMock).not.toHaveBeenCalled();
  });

  it("enforces the configured fixed company boundary", async () => {
    const response = await createRequest("42", API_KEY, "another-company");

    expect(response.status).toBe(403);
    expect(mocks.orderFindUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid display order number", async () => {
    const response = await createRequest("42x");

    expect(response.status).toBe(400);
    expect(mocks.orderFindUniqueMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the exact display ID does not exist", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue(null);

    const response = await createRequest("42");

    expect(response.status).toBe(404);
  });

  it("uses the exact companyId/displayId composite lookup", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue({
      displayId: 42,
      orderNumber: "CUSTOMER-REF",
      status: "Bekreftet",
      deliveryDate: "2026-10-01",
      timeWindow: "10:00-12:00",
      expressDelivery: false,
      customerName: "Example Customer",
      customerLabel: "Warehouse",
      pickupAddress: "Pickup street 1",
      extraPickupAddress: ["Pickup street 2"],
      deliveryAddress: "Delivery street 3",
      returnAddress: null,
      productsSummary: "2 parcels",
      deliveryTypeSummary: "Door delivery",
      servicesSummary: null,
      description: "Handle with care",
      createdAt: new Date("2026-09-20T10:00:00.000Z"),
      updatedAt: new Date("2026-09-21T11:00:00.000Z"),
    });

    const response = await createRequest("42");

    expect(response.status).toBe(200);
    expect(mocks.orderFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId_displayId: {
            companyId: COMPANY_ID,
            displayId: 42,
          },
        },
      }),
    );
    await expect(response.json()).resolves.toEqual({
      order: expect.objectContaining({
        orderNumber: 42,
        customerReference: "CUSTOMER-REF",
        status: "confirmed",
      }),
    });
  });

  it("returns 503 when the database lookup fails", async () => {
    mocks.orderFindUniqueMock.mockRejectedValue(new Error("database offline"));

    const response = await createRequest("42");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "SERVICE_UNAVAILABLE",
    });
  });
});
