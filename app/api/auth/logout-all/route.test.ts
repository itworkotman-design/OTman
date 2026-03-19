import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthEventType } from "@prisma/client";

const mocks = vi.hoisted(() => {
  return {
    getAuthenticatedSessionMock: vi.fn(),
    clearSessionCookieMock: vi.fn(),
    revokeAllUserSessionsMock: vi.fn(),
    logAuthEventMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
  clearSessionCookie: mocks.clearSessionCookieMock,
  revokeAllUserSessions: mocks.revokeAllUserSessionsMock,
}));

vi.mock("@/lib/auth/authEvent", () => ({
  logAuthEvent: mocks.logAuthEventMock,
}));

import { POST } from "./route";

describe("POST /api/auth/logout-all", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);
    mocks.revokeAllUserSessionsMock.mockResolvedValue(undefined);
    mocks.logAuthEventMock.mockResolvedValue(undefined);
  });

  it("returns 200, ok true, and clears cookie when unauthenticated", async () => {
    const req = new Request("http://localhost/api/auth/logout-all", {
      method: "POST",
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.getAuthenticatedSessionMock).toHaveBeenCalledWith(req);
    expect(mocks.clearSessionCookieMock).toHaveBeenCalledTimes(1);
    expect(mocks.clearSessionCookieMock).toHaveBeenCalledWith(res);

    expect(mocks.revokeAllUserSessionsMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("revokes all sessions, clears cookie, and logs logout when authenticated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValueOnce({
      sessionId: "session-1",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const req = new Request("http://localhost/api/auth/logout-all", {
      method: "POST",
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.getAuthenticatedSessionMock).toHaveBeenCalledWith(req);
    expect(mocks.clearSessionCookieMock).toHaveBeenCalledTimes(1);
    expect(mocks.clearSessionCookieMock).toHaveBeenCalledWith(res);

    expect(mocks.revokeAllUserSessionsMock).toHaveBeenCalledTimes(1);
    expect(mocks.revokeAllUserSessionsMock).toHaveBeenCalledWith("user-1");

    expect(mocks.logAuthEventMock).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthEventMock).toHaveBeenCalledWith({
      type: AuthEventType.LOGOUT,
      userId: "user-1",
    });
  });
});
