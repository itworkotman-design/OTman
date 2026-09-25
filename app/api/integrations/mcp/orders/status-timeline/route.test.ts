import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  orderFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { $queryRaw: mocks.queryRawMock, order: { findMany: mocks.orderFindManyMock } },
}));

import { GET } from "./route";

const API_KEY = "test-api-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const originalApiKey = process.env.OTMAN_API_KEY;
const originalCompanyId = process.env.OTMAN_API_COMPANY_ID;

function createRequest(query: string) {
  return GET(
    new Request(`http://localhost/api/integrations/mcp/orders/status-timeline${query}`, {
      headers: { Authorization: `Bearer ${API_KEY}`, "X-Otman-Company-Id": COMPANY_ID },
    }),
  );
}

describe("GET /api/integrations/mcp/orders/status-timeline", () => {
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

  it("rejects a malformed date", async () => {
    const response = await createRequest("?date=not-a-date");
    expect(response.status).toBe(400);
  });

  it("returns confirmedAt per order from the event log", async () => {
    const confirmedAt = new Date("2026-09-25T08:15:00.000Z");
    mocks.queryRawMock.mockResolvedValue([
      { displayId: 22483, status: "bekreftet", timeWindow: "10:00-16:00", confirmedAt },
    ]);

    const response = await createRequest("?date=2026-09-25");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.orders[0]).toMatchObject({
      orderNumber: 22483,
      status: "confirmed",
      timeWindow: "10:00-16:00",
      confirmedAt: confirmedAt.toISOString(),
    });
  });

  it("falls back to status/time-window only when the OrderEvent table is missing", async () => {
    mocks.queryRawMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("table not found", {
        code: "P2021",
        clientVersion: "test",
      }),
    );
    mocks.orderFindManyMock.mockResolvedValue([
      { displayId: 7, status: "aktiv", timeWindow: "12:00-14:00" },
    ]);

    const response = await createRequest("?date=2026-09-25");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.orders[0]).toMatchObject({
      orderNumber: 7,
      status: "active",
      confirmedAt: null,
    });
  });

  it("returns 503 on an unexpected database error", async () => {
    mocks.queryRawMock.mockRejectedValue(new Error("connection lost"));

    const response = await createRequest("?date=2026-09-25");

    expect(response.status).toBe(503);
  });
});
