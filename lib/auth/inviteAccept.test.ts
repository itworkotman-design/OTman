import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthEventType } from "@prisma/client";

const mocks = vi.hoisted(() => {
  return {
    hashInviteTokenMock: vi.fn(),
    findUniqueInviteMock: vi.fn(),
    findUniqueUserMock: vi.fn(),
    findUniqueMembershipMock: vi.fn(),
    transactionMock: vi.fn(),
    userCreateMock: vi.fn(),
    userUpdateMock: vi.fn(),
    membershipCreateMock: vi.fn(),
    inviteUpdateMock: vi.fn(),
    hashPasswordMock: vi.fn(),
    createSessionMock: vi.fn(),
    logAuthEventMock: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    invite: {
      findUnique: mocks.findUniqueInviteMock,
    },
    user: {
      findUnique: mocks.findUniqueUserMock,
    },
    membership: {
      findUnique: mocks.findUniqueMembershipMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

vi.mock("@/lib/auth/inviteToken", () => ({
  hashInviteToken: mocks.hashInviteTokenMock,
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: mocks.hashPasswordMock,
}));

vi.mock("@/lib/auth/createSession", () => ({
  createSession: mocks.createSessionMock,
}));

vi.mock("@/lib/auth/authEvent", () => ({
  logAuthEvent: mocks.logAuthEventMock,
}));

import { acceptInvite } from "./inviteAccept";

describe("acceptInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.hashInviteTokenMock.mockReturnValue("hashed-invite-token");

    mocks.findUniqueInviteMock.mockResolvedValue({
      id: "invite-1",
      companyId: "company-1",
      email: "InvitedUser@Example.com",
      role: "USER",
      status: "PENDING",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      username: null,
      phoneNumber: null,
      address: null,
      description: null,
      priceListId: null,
      permissions: [],
    });

    mocks.findUniqueUserMock.mockResolvedValue(null);
    mocks.findUniqueMembershipMock.mockResolvedValue(null);

    mocks.userCreateMock.mockResolvedValue({
      id: "user-1",
    });

    mocks.membershipCreateMock.mockResolvedValue({
      id: "membership-1",
    });

    mocks.inviteUpdateMock.mockResolvedValue({
      id: "invite-1",
    });

    mocks.transactionMock.mockImplementation(async (callback) => {
      return callback({
        user: {
          create: mocks.userCreateMock,
          update: mocks.userUpdateMock,
        },
        membership: {
          create: mocks.membershipCreateMock,
        },
        invite: {
          update: mocks.inviteUpdateMock,
        },
      });
    });

    mocks.hashPasswordMock.mockResolvedValue("password-hash");

    mocks.createSessionMock.mockResolvedValue({
      sessionToken: "session-token",
      sessionExpiresAt: new Date("2030-02-01T00:00:00.000Z"),
    });

    mocks.logAuthEventMock.mockResolvedValue(undefined);
  });

  it("returns INVALID_INPUT when token is blank", async () => {
    const result = await acceptInvite({
      token: "   ",
      password: "valid-pass-123",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: false, reason: "INVALID_INPUT" });
    expect(mocks.hashInviteTokenMock).not.toHaveBeenCalled();
    expect(mocks.findUniqueInviteMock).not.toHaveBeenCalled();
  });

  it("returns INVALID_INPUT when password is blank", async () => {
    const result = await acceptInvite({
      token: "plain-invite-token",
      password: "   ",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: false, reason: "INVALID_INPUT" });
    expect(mocks.hashInviteTokenMock).not.toHaveBeenCalled();
    expect(mocks.findUniqueInviteMock).not.toHaveBeenCalled();
  });

  it("returns INVALID_INVITE when invite is not found", async () => {
    mocks.findUniqueInviteMock.mockResolvedValue(null);

    const result = await acceptInvite({
      token: "plain-invite-token",
      password: "valid-pass-123",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: false, reason: "INVALID_INVITE" });
    expect(mocks.hashInviteTokenMock).toHaveBeenCalledWith(
      "plain-invite-token",
    );
    expect(mocks.findUniqueInviteMock).toHaveBeenCalledWith({
      where: {
        tokenHash: "hashed-invite-token",
      },
      select: {
        id: true,
        companyId: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        username: true,
        phoneNumber: true,
        address: true,
        description: true,
        priceListId: true,
        permissions: {
          select: {
            permission: true,
          },
        },
      },
    });
    expect(mocks.findUniqueUserMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("returns INVALID_INVITE when invite is not pending", async () => {
    mocks.findUniqueInviteMock.mockResolvedValue({
      id: "invite-1",
      companyId: "company-1",
      email: "InvitedUser@Example.com",
      role: "USER",
      status: "REVOKED",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const result = await acceptInvite({
      token: "plain-invite-token",
      password: "valid-pass-123",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: false, reason: "INVALID_INVITE" });
    expect(mocks.findUniqueUserMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("returns EXPIRED_INVITE when invite is expired", async () => {
    mocks.findUniqueInviteMock.mockResolvedValue({
      id: "invite-1",
      companyId: "company-1",
      email: "InvitedUser@Example.com",
      role: "USER",
      status: "PENDING",
      expiresAt: new Date("2000-01-01T00:00:00.000Z"),
    });

    const result = await acceptInvite({
      token: "plain-invite-token",
      password: "valid-pass-123",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: false, reason: "EXPIRED_INVITE" });
    expect(mocks.findUniqueUserMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("creates user and membership, accepts invite, creates session, and logs INVITE_ACCEPTED for a new user", async () => {
    const result = await acceptInvite({
      token: " plain-invite-token ",
      password: "valid-pass-123",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({
      ok: true,
      userId: "user-1",
      companyId: "company-1",
      sessionToken: "session-token",
      sessionExpiresAt: new Date("2030-02-01T00:00:00.000Z"),
    });

    expect(mocks.hashInviteTokenMock).toHaveBeenCalledWith(
      "plain-invite-token",
    );

    expect(mocks.findUniqueUserMock).toHaveBeenCalledWith({
      where: {
        email: "inviteduser@example.com",
      },
      select: {
        id: true,
        username: true,
        phoneNumber: true,
        address: true,
        description: true,
      },
    });

    expect(mocks.findUniqueMembershipMock).not.toHaveBeenCalled();

    expect(mocks.hashPasswordMock).toHaveBeenCalledWith("valid-pass-123");

    expect(mocks.userCreateMock).toHaveBeenCalledWith({
      data: {
        email: "inviteduser@example.com",
        username: null,
        phoneNumber: null,
        address: null,
        description: null,
        passwordHash: "password-hash",
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    expect(mocks.membershipCreateMock).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        companyId: "company-1",
        role: "USER",
        status: "ACTIVE",
        priceListId: null,
      },
      select: {
        id: true,
      },
    });

    expect(mocks.inviteUpdateMock).toHaveBeenCalledWith({
      where: {
        id: "invite-1",
      },
      data: {
        status: "ACCEPTED",
        acceptedAt: expect.any(Date),
      },
      select: {
        id: true,
      },
    });

    expect(mocks.createSessionMock).toHaveBeenCalledWith({
      userId: "user-1",
      activeCompanyId: "company-1",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(mocks.logAuthEventMock).toHaveBeenCalledWith({
      type: AuthEventType.INVITE_ACCEPTED,
      userId: "user-1",
      companyId: "company-1",
      email: "inviteduser@example.com",
      ip: "127.0.0.1",
      userAgent: "vitest",
      meta: {
        inviteId: "invite-1",
        role: "USER",
        priceListId: null,
        permissions: [],
      },
    });
  });

  it("uses existing user when invited email already belongs to a user", async () => {
    mocks.findUniqueUserMock.mockResolvedValue({
      id: "existing-user-1",
    });

    const result = await acceptInvite({
      token: "plain-invite-token",
      password: "valid-pass-123",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({
      ok: true,
      userId: "existing-user-1",
      companyId: "company-1",
      sessionToken: "session-token",
      sessionExpiresAt: new Date("2030-02-01T00:00:00.000Z"),
    });

    expect(mocks.hashPasswordMock).toHaveBeenCalledWith("valid-pass-123");
    expect(mocks.userCreateMock).not.toHaveBeenCalled();

    expect(mocks.userUpdateMock).toHaveBeenCalledWith({
      where: {
        id: "existing-user-1",
      },
      data: {
        username: undefined,
        phoneNumber: undefined,
        address: undefined,
        description: undefined,
        passwordHash: "password-hash",
        status: "ACTIVE",
      },
    });

    expect(mocks.membershipCreateMock).toHaveBeenCalledWith({
      data: {
        userId: "existing-user-1",
        companyId: "company-1",
        role: "USER",
        status: "ACTIVE",
        priceListId: null,
      },
      select: {
        id: true,
      },
    });

    expect(mocks.createSessionMock).toHaveBeenCalledWith({
      userId: "existing-user-1",
      activeCompanyId: "company-1",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });
  });

  it("returns EMAIL_ALREADY_MEMBER when user already has membership in invite company", async () => {
    mocks.findUniqueUserMock.mockResolvedValue({
      id: "existing-user-1",
    });

    mocks.findUniqueMembershipMock.mockResolvedValue({
      id: "membership-1",
    });

    const result = await acceptInvite({
      token: "plain-invite-token",
      password: "valid-pass-123",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: false, reason: "EMAIL_ALREADY_MEMBER" });

    expect(mocks.hashPasswordMock).not.toHaveBeenCalled();
    expect(mocks.userCreateMock).not.toHaveBeenCalled();
    expect(mocks.membershipCreateMock).not.toHaveBeenCalled();
    expect(mocks.inviteUpdateMock).not.toHaveBeenCalled();
    expect(mocks.createSessionMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });
});
