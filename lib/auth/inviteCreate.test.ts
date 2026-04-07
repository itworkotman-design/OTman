import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthEventType } from "@prisma/client";

const mocks = vi.hoisted(() => {
  return {
    getActiveMembershipMock: vi.fn(),
    transactionMock: vi.fn(),
    updateManyMock: vi.fn(),
    createMock: vi.fn(),
    generateInviteTokenMock: vi.fn(),
    hashInviteTokenMock: vi.fn(),
    deliverInviteMock: vi.fn(),
    logAuthEventMock: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transactionMock,
  },
}));

vi.mock("@/lib/auth/membership", () => ({
  getActiveMembership: mocks.getActiveMembershipMock,
}));

vi.mock("@/lib/auth/inviteToken", () => ({
  generateInviteToken: mocks.generateInviteTokenMock,
  hashInviteToken: mocks.hashInviteTokenMock,
}));

vi.mock("@/lib/auth/inviteDelivery", () => ({
  deliverInvite: mocks.deliverInviteMock,
}));

vi.mock("@/lib/auth/authEvent", () => ({
  logAuthEvent: mocks.logAuthEventMock,
}));

import { createInvite } from "./inviteCreate";

describe("createInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "actor-1",
      companyId: "company-1",
      role: "OWNER",
      status: "ACTIVE",
    });

    mocks.generateInviteTokenMock.mockReturnValue("plain-invite-token");
    mocks.hashInviteTokenMock.mockReturnValue("hashed-invite-token");
    mocks.deliverInviteMock.mockResolvedValue(undefined);
    mocks.logAuthEventMock.mockResolvedValue(undefined);
    mocks.updateManyMock.mockResolvedValue({ count: 0 });
    mocks.createMock.mockResolvedValue(undefined);

    mocks.transactionMock.mockImplementation(async (callback) => {
      return callback({
        invite: {
          updateMany: mocks.updateManyMock,
          create: mocks.createMock,
        },
      });
    });
  });

  it("returns INVALID_INPUT when actorUserId is blank", async () => {
    const result = await createInvite({
      actorUserId: "",
      companyId: "company-1",
      email: "user@example.com",
      role: "USER",
    });

    expect(result).toEqual({ ok: false, reason: "INVALID_INPUT" });
    expect(mocks.getActiveMembershipMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("returns INVALID_INPUT when companyId is blank", async () => {
    const result = await createInvite({
      actorUserId: "actor-1",
      companyId: "   ",
      email: "user@example.com",
      role: "USER",
    });

    expect(result).toEqual({ ok: false, reason: "INVALID_INPUT" });
    expect(mocks.getActiveMembershipMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("returns INVALID_INPUT when email is blank", async () => {
    const result = await createInvite({
      actorUserId: "actor-1",
      companyId: "company-1",
      email: "   ",
      role: "USER",
    });

    expect(result).toEqual({ ok: false, reason: "INVALID_INPUT" });
    expect(mocks.getActiveMembershipMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("returns INVALID_INPUT when role is invalid", async () => {
    const result = await createInvite({
      actorUserId: "actor-1",
      companyId: "company-1",
      email: "user@example.com",
      role: "NOPE",
    });

    expect(result).toEqual({ ok: false, reason: "INVALID_INPUT" });
    expect(mocks.getActiveMembershipMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN when actor has no active membership in company", async () => {
    mocks.getActiveMembershipMock.mockResolvedValue(null);

    const result = await createInvite({
      actorUserId: "actor-1",
      companyId: "company-1",
      email: "user@example.com",
      role: "USER",
    });

    expect(result).toEqual({ ok: false, reason: "FORBIDDEN" });

    expect(mocks.getActiveMembershipMock).toHaveBeenCalledWith({
      userId: "actor-1",
      companyId: "company-1",
    });

    expect(mocks.transactionMock).not.toHaveBeenCalled();
    expect(mocks.deliverInviteMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN when actor role is USER", async () => {
    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "actor-1",
      companyId: "company-1",
      role: "USER",
      status: "ACTIVE",
    });

    const result = await createInvite({
      actorUserId: "actor-1",
      companyId: "company-1",
      email: "user@example.com",
      role: "USER",
    });

    expect(result).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(mocks.transactionMock).not.toHaveBeenCalled();
    expect(mocks.deliverInviteMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN when ADMIN tries to invite OWNER", async () => {
    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "actor-1",
      companyId: "company-1",
      role: "ADMIN",
      status: "ACTIVE",
    });

    const result = await createInvite({
      actorUserId: "actor-1",
      companyId: "company-1",
      email: "user@example.com",
      role: "OWNER",
    });

    expect(result).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(mocks.transactionMock).not.toHaveBeenCalled();
    expect(mocks.deliverInviteMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("revokes prior pending invites, creates a new invite, delivers it, and logs INVITE_SENT", async () => {
    const result = await createInvite({
      actorUserId: "actor-1",
      companyId: "company-1",
      email: " Test@Example.com ",
      role: "ADMIN",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: true });

    expect(mocks.generateInviteTokenMock).toHaveBeenCalledTimes(1);
    expect(mocks.hashInviteTokenMock).toHaveBeenCalledWith("plain-invite-token");

    expect(mocks.transactionMock).toHaveBeenCalledTimes(1);

    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
        email: "test@example.com",
        status: "PENDING",
      },
      data: {
        status: "REVOKED",
        revokedAt: expect.any(Date),
      },
    });

    expect(mocks.createMock).toHaveBeenCalledWith({
      data: {
        companyId: "company-1",
        email: "test@example.com",
        role: "ADMIN",
        status: "PENDING",
        tokenHash: "hashed-invite-token",
        expiresAt: expect.any(Date),
        createdByUserId: "actor-1",
        username: null,
        phoneNumber: null,
        description: null,
        priceListId: null,
      },
      select: {
        id: true,
      },
    });

    expect(mocks.deliverInviteMock).toHaveBeenCalledWith({
      email: "test@example.com",
      token: "plain-invite-token",
    });

    expect(mocks.logAuthEventMock).toHaveBeenCalledWith({
      type: AuthEventType.INVITE_SENT,
      userId: "actor-1",
      companyId: "company-1",
      email: "test@example.com",
      ip: "127.0.0.1",
      userAgent: "vitest",
      meta: {
        invitedEmail: "test@example.com",
        role: "ADMIN",
        username: null,
        phoneNumber: null,
        priceListId: null,
        permissions: [],
      },
    });
  });
});
