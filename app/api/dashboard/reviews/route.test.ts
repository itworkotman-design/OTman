import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  reviewFindManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
    },
    review: {
      findMany: mocks.reviewFindManyMock,
    },
  },
}));

import { GET } from "./route";

describe("GET /api/dashboard/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/dashboard/reviews"));

    expect(res.status).toBe(401);
    expect(mocks.reviewFindManyMock).not.toHaveBeenCalled();
  });

  it("returns 403 without a DASHBOARD grant (previously had no authorization at all)", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ appAccess: [], dashboardSections: [] });

    const res = await GET(new Request("http://localhost/api/dashboard/reviews"));

    expect(res.status).toBe(403);
    expect(mocks.reviewFindManyMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the REVIEWS section is explicitly disabled", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      appAccess: [{ module: "DASHBOARD", enabled: true, level: "ADMIN" }],
      dashboardSections: [{ section: "REVIEWS", enabled: false }],
    });

    const res = await GET(new Request("http://localhost/api/dashboard/reviews"));

    expect(res.status).toBe(403);
  });

  it("does not require Booking access, and returns the latest 6 reviews", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      appAccess: [{ module: "DASHBOARD", enabled: true, level: "ADMIN" }],
      dashboardSections: [],
    });
    mocks.reviewFindManyMock.mockResolvedValue([
      { id: "r1", rating: 5, comment: "Great!", createdAt: new Date("2026-07-01T00:00:00.000Z") },
    ]);

    const res = await GET(new Request("http://localhost/api/dashboard/reviews"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      reviews: [
        { id: "r1", rating: 5, comment: "Great!", createdAt: "2026-07-01T00:00:00.000Z" },
      ],
    });
    expect(mocks.reviewFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" }, take: 6 }),
    );
  });
});
