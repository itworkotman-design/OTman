import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  getActiveMembershipMock: vi.fn(),
  userFindManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/auth/membership", () => ({
  getActiveMembership: mocks.getActiveMembershipMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findMany: mocks.userFindManyMock,
    },
  },
}));

import { GET } from "./route";

const request = () => new Request("http://localhost/api/auth/users/logos");

describe("GET /api/auth/users/logos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "u1",
      activeCompanyId: "c1",
    });
    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "USER",
      status: "ACTIVE",
      permissions: [],
      appAccess: [{ module: "USER_MANAGEMENT", enabled: true, level: "VIEWER" }],
    });
  });

  it("returns 401 when no session exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const res = await GET(request());

    expect(res.status).toBe(401);
    expect(mocks.userFindManyMock).not.toHaveBeenCalled();
  });

  it("returns 409 when no company is selected", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u1", activeCompanyId: null });

    const res = await GET(request());

    expect(res.status).toBe(409);
  });

  it("returns 403 without user management access", async () => {
    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "USER",
      status: "ACTIVE",
      permissions: [],
      appAccess: [],
    });

    const res = await GET(request());

    expect(res.status).toBe(403);
    expect(mocks.userFindManyMock).not.toHaveBeenCalled();
  });

  it("returns the distinct managed logos used by members of the active company", async () => {
    mocks.userFindManyMock.mockResolvedValue([
      { logoPath: "s3://orders/user-logos/u1/truck.svg" },
      { logoPath: "/uploads/user-logos/u2/old.png" },
      { logoPath: "https://evil.example/x.svg" },
    ]);

    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(mocks.userFindManyMock).toHaveBeenCalledWith({
      where: {
        logoPath: { not: null },
        memberships: { some: { companyId: "c1" } },
      },
      select: { logoPath: true },
      distinct: ["logoPath"],
      orderBy: { updatedAt: "desc" },
    });
    await expect(res.json()).resolves.toEqual({
      ok: true,
      logos: [
        {
          logoPath: "s3://orders/user-logos/u1/truck.svg",
          displayPath:
            "/api/auth/users/logo?path=s3%3A%2F%2Forders%2Fuser-logos%2Fu1%2Ftruck.svg",
        },
        {
          logoPath: "/uploads/user-logos/u2/old.png",
          displayPath: "/uploads/user-logos/u2/old.png",
        },
      ],
    });
  });
});
