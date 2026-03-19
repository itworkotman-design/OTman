import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
import { UserStatus } from "@prisma/client";

const mocks = vi.hoisted(() => {
  return {
    findFirstMock: vi.fn(),
    updateManyMock: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    session: {
      findFirst: mocks.findFirstMock,
      updateMany: mocks.updateManyMock,
    },
  },
}));

import { getAuthenticatedSession, SESSION_COOKIE } from "./session";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

describe("getAuthenticatedSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateManyMock.mockResolvedValue({ count: 1 });
  });

  it("returns null when cookie header is missing", async () => {
    const req = new Request("http://localhost");

    const result = await getAuthenticatedSession(req);

    expect(result).toBeNull();
    expect(mocks.findFirstMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
  });

  it("returns null when cookie header does not contain sid", async () => {
    const req = new Request("http://localhost", {
      headers: {
        cookie: "foo=bar; hello=world",
      },
    });

    const result = await getAuthenticatedSession(req);

    expect(result).toBeNull();
    expect(mocks.findFirstMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
  });

  it("returns null when sid exists but no matching session is found", async () => {
    const token = "plain-session-token";
    const req = new Request("http://localhost", {
      headers: {
        cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
      },
    });

    mocks.findFirstMock.mockResolvedValue(null);

    const result = await getAuthenticatedSession(req);

    expect(result).toBeNull();
    expect(mocks.findFirstMock).toHaveBeenCalledTimes(1);
    expect(mocks.findFirstMock).toHaveBeenCalledWith({
      where: {
        tokenHash: sha256Hex(token),
        revokedAt: null,
        expiresAt: {
          gt: expect.any(Date),
        },
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        user: {
          select: {
            email: true,
            status: true,
          },
        },
      },
    });
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
  });

  it("returns null when the session user is not ACTIVE", async () => {
    const req = new Request("http://localhost", {
      headers: {
        cookie: `${SESSION_COOKIE}=inactive-token`,
      },
    });

    mocks.findFirstMock.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      user: {
        email: "test@example.com",
        status: UserStatus.DISABLED,
      },
    });

    const result = await getAuthenticatedSession(req);

    expect(result).toBeNull();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
  });

  it("returns the authenticated session and updates lastSeenAt for an ACTIVE user", async () => {
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    const req = new Request("http://localhost", {
      headers: {
        cookie: `${SESSION_COOKIE}=valid-token`,
      },
    });

    mocks.findFirstMock.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      expiresAt,
      user: {
        email: "test@example.com",
        status: UserStatus.ACTIVE,
      },
    });

    const result = await getAuthenticatedSession(req);

    expect(result).toEqual({
      sessionId: "session-1",
      userId: "user-1",
      email: "test@example.com",
      userStatus: UserStatus.ACTIVE,
      expiresAt,
    });

    expect(mocks.updateManyMock).toHaveBeenCalledTimes(1);
    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: { lastSeenAt: expect.any(Date) },
    });
  });

  it("returns the authenticated session even when lastSeenAt update fails", async () => {
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    const req = new Request("http://localhost", {
      headers: {
        cookie: `${SESSION_COOKIE}=valid-token`,
      },
    });

    mocks.findFirstMock.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      expiresAt,
      user: {
        email: "test@example.com",
        status: UserStatus.ACTIVE,
      },
    });

    mocks.updateManyMock.mockRejectedValue(new Error("db write failed"));

    const result = await getAuthenticatedSession(req);

    expect(result).toEqual({
      sessionId: "session-1",
      userId: "user-1",
      email: "test@example.com",
      userStatus: UserStatus.ACTIVE,
      expiresAt,
    });

    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: { lastSeenAt: expect.any(Date) },
    });
  });
});