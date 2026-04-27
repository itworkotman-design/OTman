import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthEventType } from "@prisma/client";

const mocks = vi.hoisted(() => {
  return {
    getAuthenticatedSessionMock: vi.fn(),
    getActiveMembershipMock: vi.fn(),
    findUniqueMock: vi.fn(),
    updateManyMock: vi.fn(),
    userUpdateManyMock: vi.fn(),
    logAuthEventMock: vi.fn(),
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
      updateMany: mocks.updateManyMock,
    },
    user: {
      updateMany: mocks.userUpdateManyMock,
    },
  },
}));

vi.mock("@/lib/auth/authEvent", () => ({
  logAuthEvent: mocks.logAuthEventMock,
}));

import { POST } from "./route";

describe("POST /api/auth/memberships/[membershipId]/enable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateManyMock.mockResolvedValue({ count: 1 });
    mocks.userUpdateManyMock.mockResolvedValue({ count: 1 });
    mocks.logAuthEventMock.mockResolvedValue(undefined);
  });

  it("returns 401 and UNAUTHORIZED when no session exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/memberships/membership-2/enable", {
      method: "POST",
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "membership-2" }),
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });

    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 409 and TENANT_SELECTION_REQUIRED when session has no active tenant", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      email: "admin@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: null,
      activeCompanyName: null,
      activeCompanySlug: null,
    });

    const req = new Request("http://localhost/api/auth/memberships/membership-2/enable", {
      method: "POST",
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "membership-2" }),
    });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "TENANT_SELECTION_REQUIRED",
    });

    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 404 and MEMBERSHIP_NOT_FOUND when target membership does not exist", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      email: "admin@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: "company-1",
      activeCompanyName: "Company 1",
      activeCompanySlug: "company-1",
    });

    mocks.findUniqueMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/memberships/membership-2/enable", {
      method: "POST",
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "membership-2" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "MEMBERSHIP_NOT_FOUND",
    });

    expect(mocks.getActiveMembershipMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 404 and MEMBERSHIP_NOT_FOUND when target membership is not disabled", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      email: "admin@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: "company-1",
      activeCompanyName: "Company 1",
      activeCompanySlug: "company-1",
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "membership-2",
      userId: "user-2",
      companyId: "company-1",
      role: "USER",
      status: "ACTIVE",
    });

    const req = new Request("http://localhost/api/auth/memberships/membership-2/enable", {
      method: "POST",
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "membership-2" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "MEMBERSHIP_NOT_FOUND",
    });

    expect(mocks.getActiveMembershipMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 403 and FORBIDDEN when actor has no active membership in target company", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      email: "admin@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: "company-1",
      activeCompanyName: "Company 1",
      activeCompanySlug: "company-1",
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "membership-2",
      userId: "user-2",
      companyId: "company-1",
      role: "USER",
      status: "DISABLED",
    });

    mocks.getActiveMembershipMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/memberships/membership-2/enable", {
      method: "POST",
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "membership-2" }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });

    expect(mocks.getActiveMembershipMock).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: "company-1",
    });

    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 403 and FORBIDDEN when actor role is USER", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: "company-1",
      activeCompanyName: "Company 1",
      activeCompanySlug: "company-1",
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "membership-2",
      userId: "user-2",
      companyId: "company-1",
      role: "USER",
      status: "DISABLED",
      user: {
        email: "target@example.com",
        passwordHash: "$argon2id$valid",
      },
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "user-1",
      companyId: "company-1",
      role: "USER",
      status: "ACTIVE",
    });

    const req = new Request("http://localhost/api/auth/memberships/membership-2/enable", {
      method: "POST",
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "membership-2" }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });

    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 200, enables the target membership, and logs MEMBERSHIP_ENABLED", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      email: "admin@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: "company-1",
      activeCompanyName: "Company 1",
      activeCompanySlug: "company-1",
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "membership-2",
      userId: "user-2",
      companyId: "company-1",
      role: "USER",
      status: "DISABLED",
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "user-1",
      companyId: "company-1",
      role: "ADMIN",
      status: "ACTIVE",
    });

    const req = new Request("http://localhost/api/auth/memberships/membership-2/enable", {
      method: "POST",
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "membership-2" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "membership-2",
        status: "DISABLED",
      },
      data: {
        status: "ACTIVE",
      },
    });
    expect(mocks.userUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: "user-2",
        status: "DISABLED",
      },
      data: {
        status: "ACTIVE",
      },
    });
    expect(mocks.logAuthEventMock).toHaveBeenCalledWith({
      type: AuthEventType.MEMBERSHIP_ENABLED,
      userId: "user-2",
      companyId: "company-1",
      meta: {
        enabledMembershipId: "membership-2",
        actorUserId: "user-1",
      },
    });
  });
});
