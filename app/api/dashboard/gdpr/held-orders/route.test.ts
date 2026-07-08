import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirstMock },
    order: { findMany: mocks.orderFindManyMock },
  },
}));

import { GET } from "./route";

describe("GET /api/dashboard/gdpr/held-orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "OWNER" });
  });

  it("returns 403 for a non-admin membership", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "USER" });

    const res = await GET(new Request("http://localhost/api/dashboard/gdpr/held-orders"));

    expect(res.status).toBe(403);
  });

  it("returns held orders regardless of their current status, scoped to the active company", async () => {
    mocks.orderFindManyMock.mockResolvedValue([
      {
        id: "order-1",
        displayId: 21549,
        status: "paid",
        deliveryDate: "2026-01-01",
        gdprHoldReason: "test",
        gdprHoldSetAt: new Date("2026-07-08T11:21:59.824Z"),
      },
    ]);

    const res = await GET(new Request("http://localhost/api/dashboard/gdpr/held-orders"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.orders).toHaveLength(1);
    expect(json.orders[0]).toMatchObject({ displayId: 21549, status: "paid" });

    expect(mocks.orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: "company-1", gdprHold: true },
      }),
    );
  });
});
