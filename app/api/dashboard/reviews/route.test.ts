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

  it("does not require Booking access, and returns the first batch of up to 30 reviews", async () => {
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
      hasMore: false,
      nextCursor: null,
    });
    expect(mocks.reviewFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 31,
      }),
    );
  });

  it("returns a 30-review page and applies the supplied cursor to the next page", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      appAccess: [{ module: "DASHBOARD", enabled: true, level: "VIEWER" }],
      dashboardSections: [{ section: "REVIEWS", enabled: true }],
    });

    const reviewRows = Array.from({ length: 31 }, (_, index) => ({
      id: `r${index + 1}`,
      rating: 5,
      comment: null,
      createdAt: new Date(`2026-07-${String(31 - index).padStart(2, "0")}T00:00:00.000Z`),
    }));
    mocks.reviewFindManyMock.mockResolvedValue(reviewRows);

    const res = await GET(new Request("http://localhost/api/dashboard/reviews?cursor=previous-page-last-id"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reviews).toHaveLength(30);
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBe("r30");
    expect(mocks.reviewFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "previous-page-last-id" },
        skip: 1,
        take: 31,
      }),
    );
  });
});
