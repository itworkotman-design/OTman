import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  orderCountMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: { order: { count: mocks.orderCountMock } },
}));

import { POST } from "./route";

function heartbeatRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/auth/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/heartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ activeCompanyId: "company-1" });
    mocks.orderCountMock.mockResolvedValue(0);
  });

  it("counts every order in the company by default", async () => {
    await POST(heartbeatRequest({ lastChecked: "2026-10-01T00:00:00.000Z" }));

    expect(mocks.orderCountMock).toHaveBeenCalledTimes(2);
    for (const [args] of mocks.orderCountMock.mock.calls) {
      expect(args.where.companyId).toBe("company-1");
      expect(args.where).not.toHaveProperty("isWebsiteOrder");
    }
  });

  it("only counts website orders when websiteOrdersOnly is set", async () => {
    mocks.orderCountMock.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    const res = await POST(heartbeatRequest({ lastChecked: "2026-10-01T00:00:00.000Z", websiteOrdersOnly: true }));
    const data = await res.json();

    expect(mocks.orderCountMock).toHaveBeenCalledTimes(2);
    for (const [args] of mocks.orderCountMock.mock.calls) {
      expect(args.where.isWebsiteOrder).toBe(true);
    }
    expect(data).toMatchObject({ ok: true, hasNewOrders: true, hasChangedOrders: false });
  });
});
