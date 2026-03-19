import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthEventType } from "@prisma/client";

const mocks = vi.hoisted(() => {
  return {
    findUniqueMock: vi.fn(),
    transactionMock: vi.fn(),
    userUpdateMock: vi.fn(),
    tokenUpdateMock: vi.fn(),
    hashPasswordMock: vi.fn(),
    revokeAllUserSessionsMock: vi.fn(),
    hashPasswordResetTokenMock: vi.fn(),
    logAuthEventMock: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    passwordResetToken: {
      findUnique: mocks.findUniqueMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: mocks.hashPasswordMock,
}));

vi.mock("@/lib/auth/authEvent", () => ({
  logAuthEvent: mocks.logAuthEventMock,
}));

vi.mock("@/lib/auth/session", () => ({
  revokeAllUserSessions: mocks.revokeAllUserSessionsMock,
}));

vi.mock("@/lib/auth/passwordResetToken", () => ({
  hashPasswordResetToken: mocks.hashPasswordResetTokenMock,
}));

import { completePasswordReset } from "./passwordResetComplete";

describe("completePasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.hashPasswordMock.mockResolvedValue("new-password-hash");
    mocks.revokeAllUserSessionsMock.mockResolvedValue(undefined);
    mocks.hashPasswordResetTokenMock.mockReturnValue("hashed-reset-token");
    mocks.logAuthEventMock.mockResolvedValue(undefined);
    mocks.userUpdateMock.mockResolvedValue(undefined);
    mocks.tokenUpdateMock.mockResolvedValue(undefined);

    mocks.transactionMock.mockImplementation(async (callback) => {
      return callback({
        user: {
          update: mocks.userUpdateMock,
        },
        passwordResetToken: {
          update: mocks.tokenUpdateMock,
        },
      });
    });
  });

  it("rejects invalid input when token is blank", async () => {
    const result = await completePasswordReset({
      token: "   ",
      newPassword: "valid-pass-123",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: false, reason: "INVALID_INPUT" });
    expect(mocks.hashPasswordResetTokenMock).not.toHaveBeenCalled();
    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects invalid input when password is too short", async () => {
    const result = await completePasswordReset({
      token: "plain-reset-token",
      newPassword: "short",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: false, reason: "INVALID_INPUT" });
    expect(mocks.hashPasswordResetTokenMock).not.toHaveBeenCalled();
    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects missing token records", async () => {
    mocks.findUniqueMock.mockResolvedValue(null);

    const result = await completePasswordReset({
      token: "plain-reset-token",
      newPassword: "valid-pass-123",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: false, reason: "INVALID_TOKEN" });
    expect(mocks.hashPasswordResetTokenMock).toHaveBeenCalledWith("plain-reset-token");
    expect(mocks.findUniqueMock).toHaveBeenCalledWith({
      where: { tokenHash: "hashed-reset-token" },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });
    expect(mocks.hashPasswordMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("rejects already-used tokens", async () => {
    mocks.findUniqueMock.mockResolvedValue({
      id: "prt-1",
      userId: "user-1",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      usedAt: new Date("2029-01-01T00:00:00.000Z"),
    });

    const result = await completePasswordReset({
      token: "plain-reset-token",
      newPassword: "valid-pass-123",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: false, reason: "INVALID_TOKEN" });
    expect(mocks.hashPasswordMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("rejects expired tokens", async () => {
    mocks.findUniqueMock.mockResolvedValue({
      id: "prt-1",
      userId: "user-1",
      expiresAt: new Date("2000-01-01T00:00:00.000Z"),
      usedAt: null,
    });

    const result = await completePasswordReset({
      token: "plain-reset-token",
      newPassword: "valid-pass-123",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: false, reason: "EXPIRED_TOKEN" });
    expect(mocks.hashPasswordMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("updates password, marks token used, revokes sessions, and logs event for a valid token", async () => {
    mocks.findUniqueMock.mockResolvedValue({
      id: "prt-1",
      userId: "user-1",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      usedAt: null,
    });

    const result = await completePasswordReset({
      token: " plain-reset-token ",
      newPassword: "valid-pass-123",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: true });

    expect(mocks.hashPasswordResetTokenMock).toHaveBeenCalledWith("plain-reset-token");
    expect(mocks.hashPasswordMock).toHaveBeenCalledWith("valid-pass-123");

    expect(mocks.transactionMock).toHaveBeenCalledTimes(1);

    expect(mocks.userUpdateMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "new-password-hash" },
    });

    expect(mocks.tokenUpdateMock).toHaveBeenCalledWith({
      where: { id: "prt-1" },
      data: { usedAt: expect.any(Date) },
    });

    expect(mocks.revokeAllUserSessionsMock).toHaveBeenCalledWith("user-1");

    expect(mocks.logAuthEventMock).toHaveBeenCalledWith({
      type: AuthEventType.PASSWORD_RESET_SUCCESS,
      userId: "user-1",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });
  });
});
