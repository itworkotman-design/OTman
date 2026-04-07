import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    getAuthenticatedSessionMock: vi.fn(),
    findManyMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findMany: mocks.findManyMock,
    },
  },
}));

import { GET } from "./route";

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 and UNAUTHORIZED when no session exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/me", {
      method: "GET",
    });

    const res = await GET(req);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });

    expect(mocks.findManyMock).not.toHaveBeenCalled();
  });

  it("returns 200 with active tenant and no challenge when valid active tenant is selected", async () => {
    const session = {
      sessionId: "session-1",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: "company-1",
      activeCompanyName: "Company One",
      activeCompanySlug: "company-one",
    };

    mocks.getAuthenticatedSessionMock.mockResolvedValue(session);

    mocks.findManyMock.mockResolvedValue([
      {
        companyId: "company-1",
        role: "ADMIN",
        status: "ACTIVE",
        company: {
          id: "company-1",
          name: "Company One",
          slug: "company-one",
        },
      },
      {
        companyId: "company-2",
        role: "USER",
        status: "ACTIVE",
        company: {
          id: "company-2",
          name: "Company Two",
          slug: "company-two",
        },
      },
    ]);

    const req = new Request("http://localhost/api/auth/me", {
      method: "GET",
    });

    const res = await GET(req);

    expect(res.status).toBe(200);

    await expect(res.json()).resolves.toEqual({
      ok: true,
      user: {
        id: "user-1",
        email: "user@example.com",
        status: "ACTIVE",
      },
      session: {
        id: "session-1",
        expiresAt: "2030-01-01T00:00:00.000Z",
        activeCompanyId: "company-1",
      },
      requiresTenantSelection: false,
      activeTenant: {
        companyId: "company-1",
        companyName: "Company One",
        companySlug: "company-one",
        permissions: [],
        role: "ADMIN",
        status: "ACTIVE",
      },
      memberships: [
        {
          companyId: "company-1",
          companyName: "Company One",
          companySlug: "company-one",
          role: "ADMIN",
          status: "ACTIVE",
          permissions: [],
        },
        {
          companyId: "company-2",
          companyName: "Company Two",
          companySlug: "company-two",
          role: "USER",
          status: "ACTIVE",
          permissions: [],
        },
      ],
    });

    expect(mocks.findManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: "ACTIVE",
        company: {
          status: "ACTIVE",
        },
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        permissions: {
      select: {
        permission: true,
      },
    },
      },
    });
  });

  it("returns 200 with requiresTenantSelection true when multiple memberships exist and no active tenant is selected", async () => {
    const session = {
      sessionId: "session-1",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: null,
      activeCompanyName: null,
      activeCompanySlug: null,
    };

    mocks.getAuthenticatedSessionMock.mockResolvedValue(session);

    mocks.findManyMock.mockResolvedValue([
      {
        companyId: "company-1",
        role: "ADMIN",
        status: "ACTIVE",
        company: {
          id: "company-1",
          name: "Company One",
          slug: "company-one",
        },
      },
      {
        companyId: "company-2",
        role: "USER",
        status: "ACTIVE",
        company: {
          id: "company-2",
          name: "Company Two",
          slug: "company-two",
        },
      },
    ]);

    const req = new Request("http://localhost/api/auth/me", {
      method: "GET",
    });

    const res = await GET(req);

    expect(res.status).toBe(200);

    await expect(res.json()).resolves.toEqual({
      ok: true,
      user: {
        id: "user-1",
        email: "user@example.com",
        status: "ACTIVE",
      },
      session: {
        id: "session-1",
        expiresAt: "2030-01-01T00:00:00.000Z",
        activeCompanyId: null,
      },
      requiresTenantSelection: true,
      activeTenant: null,
      memberships: [
        {
          companyId: "company-1",
          companyName: "Company One",
          companySlug: "company-one",
          role: "ADMIN",
          status: "ACTIVE",
          permissions: [],
        },
        {
          companyId: "company-2",
          companyName: "Company Two",
          companySlug: "company-two",
          role: "USER",
          status: "ACTIVE",
          permissions: [],
        },
      ],
    });
  });

  it("returns 200 with no challenge when one membership exists and no active tenant is selected", async () => {
    const session = {
      sessionId: "session-1",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: null,
      activeCompanyName: null,
      activeCompanySlug: null,
    };

    mocks.getAuthenticatedSessionMock.mockResolvedValue(session);

    mocks.findManyMock.mockResolvedValue([
      {
        companyId: "company-1",
        role: "ADMIN",
        status: "ACTIVE",
        company: {
          id: "company-1",
          name: "Company One",
          slug: "company-one",
        },
      },
    ]);

    const req = new Request("http://localhost/api/auth/me", {
      method: "GET",
    });

    const res = await GET(req);

    expect(res.status).toBe(200);

    await expect(res.json()).resolves.toEqual({
      ok: true,
      user: {
        id: "user-1",
        email: "user@example.com",
        status: "ACTIVE",
      },
      session: {
        id: "session-1",
        expiresAt: "2030-01-01T00:00:00.000Z",
        activeCompanyId: null,
      },
      requiresTenantSelection: false,
      activeTenant: null,
      memberships: [
        {
          companyId: "company-1",
          companyName: "Company One",
          companySlug: "company-one",
          role: "ADMIN",
          status: "ACTIVE",
          permissions: [],
        },
      ],
    });
  });

  it("returns 200 with requiresTenantSelection true when session activeCompanyId is stale for a multi-company user", async () => {
    const session = {
      sessionId: "session-1",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: "company-stale",
      activeCompanyName: "Stale Company",
      activeCompanySlug: "stale-company",
    };

    mocks.getAuthenticatedSessionMock.mockResolvedValue(session);

    mocks.findManyMock.mockResolvedValue([
      {
        companyId: "company-1",
        role: "ADMIN",
        status: "ACTIVE",
        company: {
          id: "company-1",
          name: "Company One",
          slug: "company-one",
        },
      },
      {
        companyId: "company-2",
        role: "USER",
        status: "ACTIVE",
        company: {
          id: "company-2",
          name: "Company Two",
          slug: "company-two",
        },
      },
    ]);

    const req = new Request("http://localhost/api/auth/me", {
      method: "GET",
    });

    const res = await GET(req);

    expect(res.status).toBe(200);

    await expect(res.json()).resolves.toEqual({
      ok: true,
      user: {
        id: "user-1",
        email: "user@example.com",
        status: "ACTIVE",
      },
      session: {
        id: "session-1",
        expiresAt: "2030-01-01T00:00:00.000Z",
        activeCompanyId: null,
      },
      requiresTenantSelection: true,
      activeTenant: null,
      memberships: [
        {
          companyId: "company-1",
          companyName: "Company One",
          companySlug: "company-one",
          role: "ADMIN",
          status: "ACTIVE",
          permissions: [],
        },
        {
          companyId: "company-2",
          companyName: "Company Two",
          companySlug: "company-two",
          role: "USER",
          status: "ACTIVE",
          permissions: [],
        },
      ],
    });
  });
});
