import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthEventType } from "@prisma/client";

const mocks = vi.hoisted(() => {
  return {
    getAuthenticatedSessionMock: vi.fn(),
    updateManyMock: vi.fn(),
    logAuthEventMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    session: {
      updateMany: mocks.updateManyMock,
    },
  },
}));

vi.mock("@/lib/auth/authEvent", () => ({
  logAuthEvent: mocks.logAuthEventMock,
}));

import { POST } from "./route";

describe("POST /api/auth/sessions/revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateManyMock.mockResolvedValue({ count: 1 });
    mocks.logAuthEventMock.mockResolvedValue(undefined);
  });

  it("returns 401 and UNAUTHORIZED when no session exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/sessions/revoke", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ sessionId: "session-2" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });

    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 400 and INVALID_SESSION_ID when sessionId is missing", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-current",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const req = new Request("http://localhost/api/auth/sessions/revoke", {
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
      reason: "INVALID_SESSION_ID",
    });

    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 400 and INVALID_SESSION_ID when sessionId is not a non-empty string", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-current",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const req = new Request("http://localhost/api/auth/sessions/revoke", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ sessionId: "   " }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_SESSION_ID",
    });

    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 400 and CANNOT_REVOKE_CURRENT_SESSION when target is current session", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-current",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const req = new Request("http://localhost/api/auth/sessions/revoke", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ sessionId: "session-current" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "CANNOT_REVOKE_CURRENT_SESSION",
    });

    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 200, revokes the target session, and logs SESSION_REVOKED when a session is updated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-current",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const req = new Request("http://localhost/api/auth/sessions/revoke", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ sessionId: "session-2" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.updateManyMock).toHaveBeenCalledTimes(1);
    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "session-2",
        userId: "user-1",
        revokedAt: null,
        expiresAt: {
          gt: expect.any(Date),
        },
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });

    expect(mocks.logAuthEventMock).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthEventMock).toHaveBeenCalledWith({
      type: AuthEventType.SESSION_REVOKED,
      userId: "user-1",
      meta: {
        revokedSessionId: "session-2",
      },
    });
  });

  it("still returns 200 when zero sessions are updated and does not log an auth event", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-current",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.updateManyMock.mockResolvedValueOnce({ count: 0 });

    const req = new Request("http://localhost/api/auth/sessions/revoke", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ sessionId: "missing-session" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.updateManyMock).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });
});
