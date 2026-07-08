import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("GET /api/dashboard/gdpr/invoiced-warning", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T10:00:00.000Z"));
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "OWNER" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 403 for a non-admin membership", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "USER" });

    const res = await GET(new Request("http://localhost/api/dashboard/gdpr/invoiced-warning"));

    expect(res.status).toBe(403);
  });

  it("filters to orders invoiced more than 2 months ago and currently still invoiced", async () => {
    mocks.orderFindManyMock.mockResolvedValue([
      {
        id: "order-1",
        displayId: 101,
        deliveryDate: "2026-04-01",
        status: "invoiced",
        invoicedAt: new Date("2026-04-01T00:00:00.000Z"),
        gdprHold: false,
      },
      {
        id: "order-2",
        displayId: 102,
        deliveryDate: "2026-04-05",
        status: "paid",
        invoicedAt: new Date("2026-04-01T00:00:00.000Z"),
        gdprHold: false,
      },
    ]);

    const res = await GET(new Request("http://localhost/api/dashboard/gdpr/invoiced-warning"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.orders).toHaveLength(1);
    expect(json.orders[0]).toMatchObject({ id: "order-1", displayId: 101 });

    // setMonth is local-time based, so derive the expected cutoff the same
    // way rather than a hardcoded UTC literal (avoids DST-boundary drift).
    const expectedCutoff = new Date("2026-07-08T10:00:00.000Z");
    expectedCutoff.setMonth(expectedCutoff.getMonth() - 2);

    expect(mocks.orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-1",
          invoicedAt: { not: null, lte: expectedCutoff },
        }),
      }),
    );
  });
});
