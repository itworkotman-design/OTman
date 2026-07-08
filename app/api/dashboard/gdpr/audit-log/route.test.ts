import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderEventFindManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirstMock },
    orderEvent: { findMany: mocks.orderEventFindManyMock },
  },
}));

import { GET } from "./route";

describe("GET /api/dashboard/gdpr/audit-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "ADMIN" });
  });

  it("returns 403 for a non-admin membership", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "USER" });

    const res = await GET(new Request("http://localhost/api/dashboard/gdpr/audit-log"));

    expect(res.status).toBe(403);
  });

  it("queries only the four GDPR event types, scoped to the active company, and never returns raw PII values", async () => {
    mocks.orderEventFindManyMock.mockResolvedValue([
      {
        id: "event-1",
        type: "GDPR_ANONYMIZED",
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        actorName: null,
        actorEmail: null,
        actorSource: "SYSTEM",
        payload: { fields: ["customerName", "email"], trigger: "paid_30d" },
        order: { displayId: 101 },
      },
      {
        id: "event-2",
        type: "GDPR_HOLD_SET",
        createdAt: new Date("2026-07-02T00:00:00.000Z"),
        actorName: "Admin",
        actorEmail: "admin@example.com",
        actorSource: "USER",
        payload: { reason: "Active dispute" },
        order: { displayId: 102 },
      },
    ]);

    const res = await GET(new Request("http://localhost/api/dashboard/gdpr/audit-log"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.events).toEqual([
      expect.objectContaining({ id: "event-1", orderDisplayId: 101, actor: "System" }),
      expect.objectContaining({ id: "event-2", orderDisplayId: 102, actor: "Admin" }),
    ]);

    expect(mocks.orderEventFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: "company-1",
          type: { in: ["GDPR_ANONYMIZED", "GDPR_POD_DELETED", "GDPR_HOLD_SET", "GDPR_HOLD_REMOVED"] },
        },
      }),
    );
  });

  it("filters by an inclusive from/to date range when provided", async () => {
    mocks.orderEventFindManyMock.mockResolvedValue([]);

    await GET(
      new Request("http://localhost/api/dashboard/gdpr/audit-log?from=2026-06-01&to=2026-06-30"),
    );

    expect(mocks.orderEventFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date("2026-06-01"),
            lte: new Date("2026-06-30T23:59:59.999"),
          },
        }),
      }),
    );
  });

  it("omits the createdAt filter entirely when no range is given", async () => {
    mocks.orderEventFindManyMock.mockResolvedValue([]);

    await GET(new Request("http://localhost/api/dashboard/gdpr/audit-log"));

    const whereArg = mocks.orderEventFindManyMock.mock.calls[0][0].where;
    expect(whereArg).not.toHaveProperty("createdAt");
  });
});
