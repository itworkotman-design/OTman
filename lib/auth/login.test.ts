import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthEventType } from "@prisma/client";

const mocks = vi.hoisted(() => {
  return {
    findUniqueMock: vi.fn(),
    findFirstMock: vi.fn(),
    findManyMock: vi.fn(),
    verifyPasswordMock: vi.fn(),
    logAuthEventMock: vi.fn(),
    createSessionMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
    clearRateLimitMock: vi.fn(),
    incrementRateLimitMock: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUniqueMock,
      findFirst: mocks.findFirstMock,
    },
    membership: {
      findMany: mocks.findManyMock,
    },
  },
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: mocks.verifyPasswordMock,
}));

vi.mock("@/lib/auth/authEvent", () => ({
  logAuthEvent: mocks.logAuthEventMock,
}));

vi.mock("@/lib/auth/createSession", () => ({
  createSession: mocks.createSessionMock,
}));

vi.mock("@/lib/auth/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimitMock,
  clearRateLimit: mocks.clearRateLimitMock,
  incrementRateLimit: mocks.incrementRateLimitMock,
  LOGIN_EMAIL_LIMIT: 5,
  LOGIN_IP_LIMIT: 20,
  LOGIN_WINDOW_MS: 15 * 60 * 1000,
}));

import { loginWithIdentifierPassword } from "./login";

describe("loginWithIdentifierPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.checkRateLimitMock.mockResolvedValue({ allowed: true });
    mocks.clearRateLimitMock.mockResolvedValue(undefined);
    mocks.incrementRateLimitMock.mockResolvedValue(undefined);
    mocks.logAuthEventMock.mockResolvedValue(undefined);
    mocks.findManyMock.mockResolvedValue([]);
    mocks.createSessionMock.mockResolvedValue({
      sessionToken: "session-token",
      sessionExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
  });

  it("returns RATE_LIMITED when email bucket is blocked", async () => {
    mocks.checkRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      retryAfterMs: 1000,
    });

    const result = await loginWithIdentifierPassword({
      identifier: "test@example.com",
      password: "wrong-password",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: false, reason: "RATE_LIMITED" });
    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
    expect(mocks.findManyMock).not.toHaveBeenCalled();
    expect(mocks.incrementRateLimitMock).not.toHaveBeenCalled();
  });

  it("returns INVALID_CREDENTIALS and increments both buckets when user does not exist", async () => {
    mocks.findUniqueMock.mockResolvedValue(null);

    const result = await loginWithIdentifierPassword({
      identifier: "test@example.com",
      password: "wrong-password",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: false, reason: "INVALID_CREDENTIALS" });

    expect(mocks.logAuthEventMock).toHaveBeenCalledWith({
      type: AuthEventType.LOGIN_FAIL,
      email: "test@example.com",
      ip: "127.0.0.1",
      userAgent: "vitest",
      meta: {
        identifier: "test@example.com",
        identifierType: "email",
      },
    });

    expect(mocks.incrementRateLimitMock).toHaveBeenCalledTimes(2);
    expect(mocks.incrementRateLimitMock).toHaveBeenNthCalledWith(1, {
      key: "login:email:test@example.com",
      windowMs: 15 * 60 * 1000,
    });
    expect(mocks.incrementRateLimitMock).toHaveBeenNthCalledWith(2, {
      key: "login:ip:127.0.0.1",
      windowMs: 15 * 60 * 1000,
    });
  });

  it("looks up users by username with a case-insensitive match", async () => {
    mocks.findFirstMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      passwordHash: "hashed-password",
      status: "ACTIVE",
    });
    mocks.verifyPasswordMock.mockResolvedValue(true);
    mocks.findManyMock.mockResolvedValue([{ companyId: "company-1" }]);

    const result = await loginWithIdentifierPassword({
      identifier: "TestUser",
      password: "correct-password",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({
      ok: true,
      userId: "user-1",
      sessionToken: "session-token",
      sessionExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: "company-1",
    });

    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
    expect(mocks.findFirstMock).toHaveBeenCalledWith({
      where: {
        username: {
          equals: "testuser",
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
      },
    });

    expect(mocks.clearRateLimitMock).toHaveBeenCalledWith(
      "login:username:testuser"
    );
  });

  it("returns success and auto-selects tenant when exactly one active membership exists", async () => {
    mocks.findUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      passwordHash: "hashed-password",
      status: "ACTIVE",
    });
    mocks.verifyPasswordMock.mockResolvedValue(true);
    mocks.findManyMock.mockResolvedValue([{ companyId: "company-1" }]);

    const result = await loginWithIdentifierPassword({
      identifier: "test@example.com",
      password: "correct-password",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({
      ok: true,
      userId: "user-1",
      sessionToken: "session-token",
      sessionExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: "company-1",
    });

    expect(mocks.findManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: "ACTIVE",
        company: {
          status: "ACTIVE",
        },
      },
      select: {
        companyId: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    expect(mocks.createSessionMock).toHaveBeenCalledWith({
      userId: "user-1",
      activeCompanyId: "company-1",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(mocks.logAuthEventMock).toHaveBeenCalledWith({
      type: AuthEventType.LOGIN_SUCCESS,
      userId: "user-1",
      companyId: "company-1",
      ip: "127.0.0.1",
      userAgent: "vitest",
      meta: { autoSelectedTenant: true },
    });

    expect(mocks.clearRateLimitMock).toHaveBeenCalledWith(
      "login:email:test@example.com"
    );
  });

  it("returns success with null activeCompanyId when multiple active memberships exist", async () => {
    mocks.findUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      passwordHash: "hashed-password",
      status: "ACTIVE",
    });
    mocks.verifyPasswordMock.mockResolvedValue(true);
    mocks.findManyMock.mockResolvedValue([
      { companyId: "company-1" },
      { companyId: "company-2" },
    ]);

    const result = await loginWithIdentifierPassword({
      identifier: "test@example.com",
      password: "correct-password",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({
      ok: true,
      userId: "user-1",
      sessionToken: "session-token",
      sessionExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: null,
    });

    expect(mocks.createSessionMock).toHaveBeenCalledWith({
      userId: "user-1",
      activeCompanyId: null,
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(mocks.logAuthEventMock).toHaveBeenCalledWith({
      type: AuthEventType.LOGIN_SUCCESS,
      userId: "user-1",
      companyId: null,
      ip: "127.0.0.1",
      userAgent: "vitest",
      meta: { autoSelectedTenant: false },
    });
  });
});
