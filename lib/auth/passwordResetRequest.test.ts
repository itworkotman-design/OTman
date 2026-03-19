import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthEventType } from "@prisma/client";

const mocks = vi.hoisted(() => {
  return {
    findUniqueMock: vi.fn(),
    transactionMock: vi.fn(),
    updateManyMock: vi.fn(),
    createMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
    incrementRateLimitMock: vi.fn(),
    generatePasswordResetTokenMock: vi.fn(),
    hashPasswordResetTokenMock: vi.fn(),
    deliverPasswordResetMock: vi.fn(),
    logAuthEventMock: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUniqueMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

vi.mock("@/lib/auth/authEvent", () => ({
  logAuthEvent: mocks.logAuthEventMock,
}));

vi.mock("@/lib/auth/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimitMock,
  incrementRateLimit: mocks.incrementRateLimitMock,
  PASSWORD_RESET_EMAIL_LIMIT: 3,
  PASSWORD_RESET_IP_LIMIT: 10,
  PASSWORD_RESET_RATE_LIMIT_WINDOW_MS: 60 * 60 * 1000,
  PASSWORD_RESET_TOKEN_TTL_MS: 60 * 60 * 1000,
}));

vi.mock("@/lib/auth/passwordResetToken", () => ({
  generatePasswordResetToken: mocks.generatePasswordResetTokenMock,
  hashPasswordResetToken: mocks.hashPasswordResetTokenMock,
}));

vi.mock("@/lib/auth/passwordResetDelivery", () => ({
  deliverPasswordReset: mocks.deliverPasswordResetMock,
}));

import { requestPasswordReset } from "./passwordResetRequest";

describe("requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.checkRateLimitMock.mockResolvedValue({ allowed: true });
    mocks.incrementRateLimitMock.mockResolvedValue(undefined);
    mocks.findUniqueMock.mockResolvedValue(null);
    mocks.generatePasswordResetTokenMock.mockReturnValue("plain-reset-token");
    mocks.hashPasswordResetTokenMock.mockReturnValue("hashed-reset-token");
    mocks.deliverPasswordResetMock.mockResolvedValue(undefined);
    mocks.logAuthEventMock.mockResolvedValue(undefined);
    mocks.updateManyMock.mockResolvedValue({ count: 0 });
    mocks.createMock.mockResolvedValue(undefined);

    mocks.transactionMock.mockImplementation(async (callback) => {
      return callback({
        passwordResetToken: {
          updateMany: mocks.updateManyMock,
          create: mocks.createMock,
        },
      });
    });
  });

  it("returns RATE_LIMITED when email bucket is blocked", async () => {
    mocks.checkRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      retryAfterMs: 1000,
    });

    const result = await requestPasswordReset({
      email: "test@example.com",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: false, reason: "RATE_LIMITED" });
    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
    expect(mocks.incrementRateLimitMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
    expect(mocks.deliverPasswordResetMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMITED when ip bucket is blocked", async () => {
    mocks.checkRateLimitMock
      .mockResolvedValueOnce({ allowed: true })
      .mockResolvedValueOnce({ allowed: false, retryAfterMs: 1000 });

    const result = await requestPasswordReset({
      email: "test@example.com",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: false, reason: "RATE_LIMITED" });
    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
    expect(mocks.incrementRateLimitMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("returns generic success for unknown user and increments both buckets", async () => {
    mocks.findUniqueMock.mockResolvedValue(null);

    const result = await requestPasswordReset({
      email: "test@example.com",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: true });

    expect(mocks.findUniqueMock).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
      select: { id: true, status: true },
    });

    expect(mocks.incrementRateLimitMock).toHaveBeenCalledTimes(2);
    expect(mocks.incrementRateLimitMock).toHaveBeenNthCalledWith(1, {
      key: "password-reset:email:test@example.com",
      windowMs: 60 * 60 * 1000,
    });
    expect(mocks.incrementRateLimitMock).toHaveBeenNthCalledWith(2, {
      key: "password-reset:ip:127.0.0.1",
      windowMs: 60 * 60 * 1000,
    });

    expect(mocks.transactionMock).not.toHaveBeenCalled();
    expect(mocks.deliverPasswordResetMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns generic success for inactive user", async () => {
    mocks.findUniqueMock.mockResolvedValue({
      id: "user-1",
      status: "DISABLED",
    });

    const result = await requestPasswordReset({
      email: "test@example.com",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: true });
    expect(mocks.transactionMock).not.toHaveBeenCalled();
    expect(mocks.deliverPasswordResetMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns generic success for blank email and still increments rate limits", async () => {
    const result = await requestPasswordReset({
      email: "   ",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: true });

    expect(mocks.findUniqueMock).not.toHaveBeenCalled();

    expect(mocks.incrementRateLimitMock).toHaveBeenCalledTimes(2);
    expect(mocks.incrementRateLimitMock).toHaveBeenNthCalledWith(1, {
      key: "password-reset:email:",
      windowMs: 60 * 60 * 1000,
    });
    expect(mocks.incrementRateLimitMock).toHaveBeenNthCalledWith(2, {
      key: "password-reset:ip:127.0.0.1",
      windowMs: 60 * 60 * 1000,
    });
  });

  it("creates a reset token, invalidates older tokens, delivers reset, and logs event for active user", async () => {
    mocks.findUniqueMock.mockResolvedValue({
      id: "user-1",
      status: "ACTIVE",
    });

    const result = await requestPasswordReset({
      email: " Test@Example.com ",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: true });

    expect(mocks.generatePasswordResetTokenMock).toHaveBeenCalledTimes(1);
    expect(mocks.hashPasswordResetTokenMock).toHaveBeenCalledWith("plain-reset-token");

    expect(mocks.transactionMock).toHaveBeenCalledTimes(1);

    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        usedAt: null,
      },
      data: {
        usedAt: expect.any(Date),
      },
    });

    expect(mocks.createMock).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        tokenHash: "hashed-reset-token",
        expiresAt: expect.any(Date),
      },
    });

    expect(mocks.deliverPasswordResetMock).toHaveBeenCalledWith({
      email: "test@example.com",
      token: "plain-reset-token",
    });

    expect(mocks.logAuthEventMock).toHaveBeenCalledWith({
      type: AuthEventType.PASSWORD_RESET_REQUEST,
      userId: "user-1",
      email: "test@example.com",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });
  });

  it("increments only the email bucket when ip is missing", async () => {
    await requestPasswordReset({
      email: "test@example.com",
      userAgent: "vitest",
    });

    expect(mocks.checkRateLimitMock).toHaveBeenCalledTimes(1);
    expect(mocks.checkRateLimitMock).toHaveBeenCalledWith({
      key: "password-reset:email:test@example.com",
      limit: 3,
    });

    expect(mocks.incrementRateLimitMock).toHaveBeenCalledTimes(1);
    expect(mocks.incrementRateLimitMock).toHaveBeenCalledWith({
      key: "password-reset:email:test@example.com",
      windowMs: 60 * 60 * 1000,
    });
  });
});
