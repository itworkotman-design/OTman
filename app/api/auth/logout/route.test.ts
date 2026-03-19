import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthEventType } from "@prisma/client";

const mocks = vi.hoisted(() => {
  return {
    getAuthenticatedSessionMock: vi.fn(),
    clearSessionCookieMock: vi.fn(),
    updateManyMock: vi.fn(),
    logAuthEventMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
  clearSessionCookie: mocks.clearSessionCookieMock,
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

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);
    mocks.updateManyMock.mockResolvedValue({ count: 1 });
    mocks.logAuthEventMock.mockResolvedValue(undefined);
  });

  it("returns 200, ok true, and clears the session cookie when no authenticated session exists", async () => {
    const req = new Request("http://localhost/api/auth/logout", {
      method: "POST",
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.getAuthenticatedSessionMock).toHaveBeenCalledWith(req);
    expect(mocks.clearSessionCookieMock).toHaveBeenCalledTimes(1);
    expect(mocks.clearSessionCookieMock).toHaveBeenCalledWith(res);
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns 200, ok true, clears the cookie, revokes the session, and logs logout when an authenticated session exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValueOnce({
      sessionId: "session-1",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const req = new Request("http://localhost/api/auth/logout", {
      method: "POST",
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.getAuthenticatedSessionMock).toHaveBeenCalledWith(req);
    expect(mocks.clearSessionCookieMock).toHaveBeenCalledTimes(1);
    expect(mocks.clearSessionCookieMock).toHaveBeenCalledWith(res);

    expect(mocks.updateManyMock).toHaveBeenCalledTimes(1);
    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "session-1",
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });

    expect(mocks.logAuthEventMock).toHaveBeenCalledTimes(1);
    expect(mocks.logAuthEventMock).toHaveBeenCalledWith({
      type: AuthEventType.LOGOUT,
      userId: "user-1",
    });
  });
});