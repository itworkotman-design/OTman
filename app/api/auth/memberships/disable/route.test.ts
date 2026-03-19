import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthEventType } from "@prisma/client";

const mocks = vi.hoisted(() => {
  return {
    getAuthenticatedSessionMock: vi.fn(),
    getActiveMembershipMock: vi.fn(),
    updateManyMock: vi.fn(),
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
      updateMany: mocks.updateManyMock,
    },
  },
}));

vi.mock("@/lib/auth/authEvent", () => ({
  logAuthEvent: mocks.logAuthEventMock,
}));

import { POST } from "./route";

describe("POST /api/auth/memberships/disable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateManyMock.mockResolvedValue({ count: 1 });
    mocks.logAuthEventMock.mockResolvedValue(undefined);
  });

  it("returns 401 and UNAUTHORIZED when no session exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/memberships/disable", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ companyId: "company-1" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });

    expect(mocks.getActiveMembershipMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 400 and INVALID_COMPANY_ID when companyId is missing", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const req = new Request("http://localhost/api/auth/memberships/disable", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_COMPANY_ID",
    });

    expect(mocks.getActiveMembershipMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 400 and INVALID_COMPANY_ID when companyId is blank", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const req = new Request("http://localhost/api/auth/memberships/disable", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ companyId: "   " }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_COMPANY_ID",
    });

    expect(mocks.getActiveMembershipMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 404 and MEMBERSHIP_NOT_FOUND when no active membership exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.getActiveMembershipMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/memberships/disable", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ companyId: "company-1" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "MEMBERSHIP_NOT_FOUND",
    });

    expect(mocks.getActiveMembershipMock).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: "company-1",
    });

    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 200, disables the membership, and logs MEMBERSHIP_DISABLED", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "user-1",
      companyId: "company-1",
      role: "ADMIN",
      status: "ACTIVE",
    });

    const req = new Request("http://localhost/api/auth/memberships/disable", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ companyId: "company-1" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.updateManyMock).toHaveBeenCalledTimes(1);
    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        companyId: "company-1",
        status: "ACTIVE",
      },
      data: {
        status: "DISABLED",
      },
    });

    expect(mocks.logAuthEventMock).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthEventMock).toHaveBeenCalledWith({
      type: AuthEventType.MEMBERSHIP_DISABLED,
      userId: "user-1",
      companyId: "company-1",
      meta: {
        disabledUserId: "user-1",
        companyId: "company-1",
      },
    });
  });
});