import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    getAuthenticatedSessionMock: vi.fn(),
    getActiveMembershipMock: vi.fn(),
    findUniqueMock: vi.fn(),
    userUpdateMock: vi.fn(),
    membershipPermissionDeleteManyMock: vi.fn(),
    membershipPermissionCreateManyMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/auth/membership", () => ({
  getActiveMembership: mocks.getActiveMembershipMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findUnique: mocks.findUniqueMock,
    },
    user: {
      update: mocks.userUpdateMock,
    },
    membershipPermission: {
      deleteMany: mocks.membershipPermissionDeleteManyMock,
      createMany: mocks.membershipPermissionCreateManyMock,
    },
  },
}));

import { PATCH } from "./route";

describe("PATCH /api/auth/memberships/[membershipId]/update", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.userUpdateMock.mockResolvedValue({
      id: "u2",
      email: "updated@example.com",
      username: "updateduser",
      phoneNumber: "12345678",
      description: "Updated description",
      status: "ACTIVE",
    });

    mocks.membershipPermissionDeleteManyMock.mockResolvedValue({ count: 0 });
    mocks.membershipPermissionCreateManyMock.mockResolvedValue({ count: 0 });
  });

  it("returns 401 and UNAUTHORIZED when no session exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/memberships/m2/update", {
      method: "PATCH",
      body: JSON.stringify({
        email: "updated@example.com",
        username: "updateduser",
        phoneNumber: "12345678",
        description: "Updated description",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });

    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
    expect(mocks.userUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 409 and TENANT_SELECTION_REQUIRED when session has no activeCompanyId", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "owner@example.com",
      userStatus: "ACTIVE",
      activeCompanyId: null,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const req = new Request("http://localhost/api/auth/memberships/m2/update", {
      method: "PATCH",
      body: JSON.stringify({
        email: "updated@example.com",
        username: "updateduser",
        phoneNumber: "12345678",
        description: "Updated description",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "TENANT_SELECTION_REQUIRED",
    });

    expect(mocks.getActiveMembershipMock).not.toHaveBeenCalled();
    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
    expect(mocks.userUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 403 and FORBIDDEN when actor has no active membership", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "admin@example.com",
      userStatus: "ACTIVE",
      activeCompanyId: "c1",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.getActiveMembershipMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/memberships/m2/update", {
      method: "PATCH",
      body: JSON.stringify({
        email: "updated@example.com",
        username: "updateduser",
        phoneNumber: "12345678",
        description: "Updated description",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });

    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
    expect(mocks.userUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 403 and FORBIDDEN when actor role is USER", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      activeCompanyId: "c1",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "USER",
      status: "ACTIVE",
      permissions: [],
    });

    const req = new Request("http://localhost/api/auth/memberships/m2/update", {
      method: "PATCH",
      body: JSON.stringify({
        email: "updated@example.com",
        username: "updateduser",
        phoneNumber: "12345678",
        description: "Updated description",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });

    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
    expect(mocks.userUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 404 and NOT_FOUND when target membership does not exist", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "owner@example.com",
      userStatus: "ACTIVE",
      activeCompanyId: "c1",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "OWNER",
      status: "ACTIVE",
      permissions: [],
    });

    mocks.findUniqueMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/memberships/m2/update", {
      method: "PATCH",
      body: JSON.stringify({
        email: "updated@example.com",
        username: "updateduser",
        phoneNumber: "12345678",
        description: "Updated description",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });

    expect(mocks.userUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 404 and NOT_FOUND when target membership belongs to another company", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "owner@example.com",
      userStatus: "ACTIVE",
      activeCompanyId: "c1",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "OWNER",
      status: "ACTIVE",
      permissions: [],
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      role: "USER",
      status: "ACTIVE",
      companyId: "c2",
      userId: "u2",
    });

    const req = new Request("http://localhost/api/auth/memberships/m2/update", {
      method: "PATCH",
      body: JSON.stringify({
        email: "updated@example.com",
        username: "updateduser",
        phoneNumber: "12345678",
        description: "Updated description",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });

    expect(mocks.userUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 403 and FORBIDDEN when ADMIN tries to update OWNER membership", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "admin@example.com",
      userStatus: "ACTIVE",
      activeCompanyId: "c1",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "ADMIN",
      status: "ACTIVE",
      permissions: [],
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      role: "OWNER",
      status: "ACTIVE",
      companyId: "c1",
      userId: "u2",
    });

    const req = new Request("http://localhost/api/auth/memberships/m2/update", {
      method: "PATCH",
      body: JSON.stringify({
        email: "updated@example.com",
        username: "updateduser",
        phoneNumber: "12345678",
        description: "Updated description",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });

    expect(mocks.userUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 200 and updates the related user for OWNER", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "owner@example.com",
      userStatus: "ACTIVE",
      activeCompanyId: "c1",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "OWNER",
      status: "ACTIVE",
      permissions: [],
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      role: "USER",
      status: "ACTIVE",
      companyId: "c1",
      userId: "u2",
    });

    const req = new Request("http://localhost/api/auth/memberships/m2/update", {
      method: "PATCH",
      body: JSON.stringify({
        email: "updated@example.com",
        username: "updateduser",
        phoneNumber: "12345678",
        description: "Updated description",
        permissions: ["BOOKING_VIEW"],
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      user: {
        id: "u2",
        email: "updated@example.com",
        username: "updateduser",
        phoneNumber: "12345678",
        description: "Updated description",
        status: "ACTIVE",
      },
    });

    expect(mocks.userUpdateMock).toHaveBeenCalledWith({
      where: { id: "u2" },
      data: {
        email: "updated@example.com",
        username: "updateduser",
        phoneNumber: "12345678",
        description: "Updated description",
      },
      select: {
        id: true,
        email: true,
        username: true,
        phoneNumber: true,
        description: true,
        status: true,
      },
    });

    expect(mocks.membershipPermissionDeleteManyMock).toHaveBeenCalledWith({
      where: {
        membershipId: "m2",
      },
    });

    expect(mocks.membershipPermissionCreateManyMock).toHaveBeenCalledWith({
      data: [
        {
          membershipId: "m2",
          permission: "BOOKING_VIEW",
        },
      ],
    });
  });

  it("returns 200 and updates the related user for ADMIN editing USER", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "admin@example.com",
      userStatus: "ACTIVE",
      activeCompanyId: "c1",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "ADMIN",
      status: "ACTIVE",
      permissions: [],
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      role: "USER",
      status: "ACTIVE",
      companyId: "c1",
      userId: "u2",
    });

    const req = new Request("http://localhost/api/auth/memberships/m2/update", {
      method: "PATCH",
      body: JSON.stringify({
        email: "updated@example.com",
        username: "updateduser",
        phoneNumber: "12345678",
        description: "Updated description",
        permissions: ["BOOKING_VIEW", "BOOKING_CREATE"],
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      user: {
        id: "u2",
        email: "updated@example.com",
        username: "updateduser",
        phoneNumber: "12345678",
        description: "Updated description",
        status: "ACTIVE",
      },
    });

    expect(mocks.userUpdateMock).toHaveBeenCalledWith({
      where: { id: "u2" },
      data: {
        email: "updated@example.com",
        username: "updateduser",
        phoneNumber: "12345678",
        description: "Updated description",
      },
      select: {
        id: true,
        email: true,
        username: true,
        phoneNumber: true,
        description: true,
        status: true,
      },
    });

    expect(mocks.membershipPermissionDeleteManyMock).toHaveBeenCalledWith({
      where: {
        membershipId: "m2",
      },
    });

    expect(mocks.membershipPermissionCreateManyMock).toHaveBeenCalledWith({
      data: [
        {
          membershipId: "m2",
          permission: "BOOKING_VIEW",
        },
        {
          membershipId: "m2",
          permission: "BOOKING_CREATE",
        },
      ],
    });
  });
});