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
    session: {
      findMany: mocks.findManyMock,
    },
  },
}));

import { GET } from "./route";

describe("GET /api/auth/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 and UNAUTHORIZED when no session exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/sessions", {
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

  it("returns 200 and active sessions for the authenticated user", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-current",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-10T00:00:00.000Z"),
    });

    mocks.findManyMock.mockResolvedValue([
      {
        id: "session-current",
        expiresAt: new Date("2030-01-10T00:00:00.000Z"),
        lastSeenAt: new Date("2030-01-05T12:00:00.000Z"),
        createdAt: new Date("2030-01-01T09:00:00.000Z"),
      },
      {
        id: "session-2",
        expiresAt: new Date("2030-01-08T00:00:00.000Z"),
        lastSeenAt: null,
        createdAt: new Date("2030-01-02T10:30:00.000Z"),
      },
    ]);

    const req = new Request("http://localhost/api/auth/sessions", {
      method: "GET",
    });

    const res = await GET(req);

    expect(res.status).toBe(200);

    await expect(res.json()).resolves.toEqual({
      ok: true,
      currentSessionId: "session-current",
      sessions: [
        {
          id: "session-current",
          expiresAt: "2030-01-10T00:00:00.000Z",
          lastSeenAt: "2030-01-05T12:00:00.000Z",
          createdAt: "2030-01-01T09:00:00.000Z",
        },
        {
          id: "session-2",
          expiresAt: "2030-01-08T00:00:00.000Z",
          lastSeenAt: null,
          createdAt: "2030-01-02T10:30:00.000Z",
        },
      ],
    });

    expect(mocks.findManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        revokedAt: null,
        expiresAt: {
          gt: expect.any(Date),
        },
      },
      select: {
        id: true,
        expiresAt: true,
        lastSeenAt: true,
        createdAt: true,
      },
      orderBy: [
        { lastSeenAt: "desc" },
        { createdAt: "desc" },
      ],
    });
  });
});
