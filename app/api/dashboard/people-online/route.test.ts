import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  membershipFindManyMock: vi.fn(),
  sessionFindManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
      findMany: mocks.membershipFindManyMock,
    },
    session: {
      findMany: mocks.sessionFindManyMock,
    },
  },
}));

import { GET } from "./route";

describe("GET /api/dashboard/people-online", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      appAccess: [{ module: "DASHBOARD", enabled: true, level: "ADMIN" }],
      dashboardSections: [],
    });
  });

  it("returns 403 without a DASHBOARD grant", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({ appAccess: [], dashboardSections: [] });

    const res = await GET(new Request("http://localhost/api/dashboard/people-online"));

    expect(res.status).toBe(403);
    expect(mocks.membershipFindManyMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the PEOPLE_ONLINE section is explicitly disabled", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({
      appAccess: [{ module: "DASHBOARD", enabled: true, level: "ADMIN" }],
      dashboardSections: [{ section: "PEOPLE_ONLINE", enabled: false }],
    });

    const res = await GET(new Request("http://localhost/api/dashboard/people-online"));

    expect(res.status).toBe(403);
  });

  it("does not require Booking access (unlike BOOKING_OVERVIEW/QUICK_TASKS)", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({
      appAccess: [{ module: "DASHBOARD", enabled: true, level: "ADMIN" }],
      dashboardSections: [],
    });
    mocks.membershipFindManyMock.mockResolvedValue([]);
    mocks.sessionFindManyMock.mockResolvedValue([]);

    const res = await GET(new Request("http://localhost/api/dashboard/people-online"));

    expect(res.status).toBe(200);
  });

  it("returns only members with an active recent session, trimmed to a lightweight shape", async () => {
    mocks.membershipFindManyMock.mockResolvedValue([
      { id: "m1", role: "OWNER", user: { id: "u1", email: "owner@example.com", username: "Owner", description: null } },
      { id: "m2", role: "USER", user: { id: "u2", email: "user@example.com", username: null, description: "desc" } },
    ]);
    mocks.sessionFindManyMock.mockResolvedValue([{ userId: "u1" }]);

    const res = await GET(new Request("http://localhost/api/dashboard/people-online"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      members: [
        {
          id: "m1",
          role: "OWNER",
          user: { email: "owner@example.com", username: "Owner", description: null },
        },
      ],
    });
  });
});
