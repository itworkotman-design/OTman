import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthEventType } from "@prisma/client";

const mocks = vi.hoisted(() => {
  return {
    getAuthenticatedSessionMock: vi.fn(),
    getActiveMembershipMock: vi.fn(),
    findUniqueMock: vi.fn(),
    countMock: vi.fn(),
    updateManyMock: vi.fn(),
    revokeAllUserSessionsMock: vi.fn(),
    logAuthEventMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
  revokeAllUserSessions: mocks.revokeAllUserSessionsMock,
}));

vi.mock("@/lib/auth/membership", () => ({
  getActiveMembership: mocks.getActiveMembershipMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findUnique: mocks.findUniqueMock,
      count: mocks.countMock,
      updateMany: mocks.updateManyMock,
    },
  },
}));

vi.mock("@/lib/auth/authEvent", () => ({
  logAuthEvent: mocks.logAuthEventMock,
}));

import { POST } from "./route";

describe("POST /api/auth/memberships/[membershipId]/role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateManyMock.mockResolvedValue({ count: 1 });
    mocks.countMock.mockResolvedValue(2);
    mocks.logAuthEventMock.mockResolvedValue(undefined);
    mocks.revokeAllUserSessionsMock.mockResolvedValue(undefined);
  });

  it("returns 401 and UNAUTHORIZED when no session exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/memberships/m2/role", {
      method: "POST",
      body: JSON.stringify({ role: "ADMIN" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });

    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.revokeAllUserSessionsMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 404 and MEMBERSHIP_NOT_FOUND when target membership does not exist", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "owner@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.findUniqueMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/memberships/m2/role", {
      method: "POST",
      body: JSON.stringify({ role: "ADMIN" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "MEMBERSHIP_NOT_FOUND",
    });

    expect(mocks.getActiveMembershipMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.revokeAllUserSessionsMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 404 and MEMBERSHIP_NOT_FOUND when target membership is not active", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "owner@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      userId: "u2",
      companyId: "c1",
      role: "USER",
      status: "DISABLED",
    });

    const req = new Request("http://localhost/api/auth/memberships/m2/role", {
      method: "POST",
      body: JSON.stringify({ role: "ADMIN" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "MEMBERSHIP_NOT_FOUND",
    });

    expect(mocks.getActiveMembershipMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.revokeAllUserSessionsMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 403 and FORBIDDEN when actor has no active membership in target company", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "owner@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      userId: "u2",
      companyId: "c1",
      role: "USER",
      status: "ACTIVE",
    });

    mocks.getActiveMembershipMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/memberships/m2/role", {
      method: "POST",
      body: JSON.stringify({ role: "ADMIN" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });

    expect(mocks.getActiveMembershipMock).toHaveBeenCalledWith({
      userId: "u1",
      companyId: "c1",
    });

    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.revokeAllUserSessionsMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 403 and FORBIDDEN when actor role is USER", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      userId: "u2",
      companyId: "c1",
      role: "USER",
      status: "ACTIVE",
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "USER",
      status: "ACTIVE",
    });

    const req = new Request("http://localhost/api/auth/memberships/m2/role", {
      method: "POST",
      body: JSON.stringify({ role: "ADMIN" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });

    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.revokeAllUserSessionsMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 400 and INVALID_ROLE when body role is invalid", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "owner@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      userId: "u2",
      companyId: "c1",
      role: "USER",
      status: "ACTIVE",
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "OWNER",
      status: "ACTIVE",
    });

    const req = new Request("http://localhost/api/auth/memberships/m2/role", {
      method: "POST",
      body: JSON.stringify({ role: "INVALID" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_ROLE",
    });

    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.revokeAllUserSessionsMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 403 and FORBIDDEN when ADMIN tries to change an OWNER membership", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "admin@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      userId: "u2",
      companyId: "c1",
      role: "OWNER",
      status: "ACTIVE",
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "ADMIN",
      status: "ACTIVE",
    });

    const req = new Request("http://localhost/api/auth/memberships/m2/role", {
      method: "POST",
      body: JSON.stringify({ role: "ADMIN" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });

    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.revokeAllUserSessionsMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 403 and FORBIDDEN when ADMIN tries to assign OWNER", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "admin@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      userId: "u2",
      companyId: "c1",
      role: "USER",
      status: "ACTIVE",
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "ADMIN",
      status: "ACTIVE",
    });

    const req = new Request("http://localhost/api/auth/memberships/m2/role", {
      method: "POST",
      body: JSON.stringify({ role: "OWNER" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });

    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.revokeAllUserSessionsMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 400 and CANNOT_CHANGE_LAST_OWNER when demoting the last active owner", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "owner@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      userId: "u2",
      companyId: "c1",
      role: "OWNER",
      status: "ACTIVE",
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "OWNER",
      status: "ACTIVE",
    });

    mocks.countMock.mockResolvedValueOnce(1);

    const req = new Request("http://localhost/api/auth/memberships/m2/role", {
      method: "POST",
      body: JSON.stringify({ role: "USER" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "CANNOT_CHANGE_LAST_OWNER",
    });

    expect(mocks.countMock).toHaveBeenCalledWith({
      where: {
        companyId: "c1",
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.revokeAllUserSessionsMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 200, changes role, revokes sessions, and logs MEMBERSHIP_ROLE_CHANGED for OWNER actor", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "owner@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      userId: "u2",
      companyId: "c1",
      role: "USER",
      status: "ACTIVE",
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "OWNER",
      status: "ACTIVE",
    });

    const req = new Request("http://localhost/api/auth/memberships/m2/role", {
      method: "POST",
      body: JSON.stringify({ role: "ADMIN" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "m2",
        status: "ACTIVE",
      },
      data: {
        role: "ADMIN",
      },
    });

    expect(mocks.revokeAllUserSessionsMock).toHaveBeenCalledWith("u2");

    expect(mocks.logAuthEventMock).toHaveBeenCalledWith({
      type: AuthEventType.MEMBERSHIP_ROLE_CHANGED,
      userId: "u2",
      companyId: "c1",
      meta: {
        membershipId: "m2",
        previousRole: "USER",
        newRole: "ADMIN",
        actorUserId: "u1",
      },
    });
  });

  it("returns 200, changes role, revokes sessions, and logs MEMBERSHIP_ROLE_CHANGED for ADMIN actor changing USER to ADMIN", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "admin@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      userId: "u2",
      companyId: "c1",
      role: "USER",
      status: "ACTIVE",
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "ADMIN",
      status: "ACTIVE",
    });

    const req = new Request("http://localhost/api/auth/memberships/m2/role", {
      method: "POST",
      body: JSON.stringify({ role: "ADMIN" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "m2",
        status: "ACTIVE",
      },
      data: {
        role: "ADMIN",
      },
    });

    expect(mocks.revokeAllUserSessionsMock).toHaveBeenCalledWith("u2");

    expect(mocks.logAuthEventMock).toHaveBeenCalledWith({
      type: AuthEventType.MEMBERSHIP_ROLE_CHANGED,
      userId: "u2",
      companyId: "c1",
      meta: {
        membershipId: "m2",
        previousRole: "USER",
        newRole: "ADMIN",
        actorUserId: "u1",
      },
    });
  });
});