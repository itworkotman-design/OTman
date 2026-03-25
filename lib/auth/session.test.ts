import { createHash } from "crypto";
import { UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
        activeCompanyId: true,
        activeCompany: {
          select: {
            name: true,
            slug: true,
            status: true,
          },
        },
        user: {
          select: {
            email: true,
            username: true,
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
      activeCompanyId: null,
      activeCompany: null,
      user: {
        email: "test@example.com",
        status: UserStatus.DISABLED,
      },
    });

    const result = await getAuthenticatedSession(req);

    expect(result).toBeNull();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
  });

  it("returns authenticated session with active tenant when company is ACTIVE", async () => {
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
      activeCompanyId: "company-1",
      activeCompany: {
        name: "Company One",
        slug: "company-one",
        status: "ACTIVE",
      },
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
      activeCompanyId: "company-1",
      activeCompanyName: "Company One",
      activeCompanySlug: "company-one",
    });

    expect(mocks.updateManyMock).toHaveBeenCalledTimes(1);
    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: { lastSeenAt: expect.any(Date) },
    });
  });

  it("returns authenticated session with null active tenant when company is missing", async () => {
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
      activeCompanyId: null,
      activeCompany: null,
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
      activeCompanyId: null,
      activeCompanyName: null,
      activeCompanySlug: null,
    });
  });

  it("returns authenticated session with null active tenant when company is not ACTIVE", async () => {
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
      activeCompanyId: "company-1",
      activeCompany: {
        name: "Company One",
        slug: "company-one",
        status: "DISABLED",
      },
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
      activeCompanyId: null,
      activeCompanyName: null,
      activeCompanySlug: null,
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
      activeCompanyId: "company-1",
      activeCompany: {
        name: "Company One",
        slug: "company-one",
        status: "ACTIVE",
      },
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
      activeCompanyId: "company-1",
      activeCompanyName: "Company One",
      activeCompanySlug: "company-one",
    });

    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: { lastSeenAt: expect.any(Date) },
    });
  });
});