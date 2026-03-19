import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthEventType } from "@prisma/client";

const mocks = vi.hoisted(() => {
  return {
    getActiveMembershipMock: vi.fn(),
    findUniqueMock: vi.fn(),
    updateManyMock: vi.fn(),
    logAuthEventMock: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    invite: {
      findUnique: mocks.findUniqueMock,
      updateMany: mocks.updateManyMock,
    },
  },
}));

vi.mock("@/lib/auth/membership", () => ({
  getActiveMembership: mocks.getActiveMembershipMock,
}));

vi.mock("@/lib/auth/authEvent", () => ({
  logAuthEvent: mocks.logAuthEventMock,
}));

import { revokeInvite } from "./inviteRevoke";

describe("revokeInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.findUniqueMock.mockResolvedValue({
      id: "invite-1",
      companyId: "company-1",
      email: "user@example.com",
      role: "USER",
      status: "PENDING",
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "actor-1",
      companyId: "company-1",
      role: "OWNER",
      status: "ACTIVE",
    });

    mocks.updateManyMock.mockResolvedValue({ count: 1 });
    mocks.logAuthEventMock.mockResolvedValue(undefined);
  });

  it("returns INVITE_NOT_FOUND when actorUserId is blank", async () => {
    const result = await revokeInvite({
      actorUserId: "",
      inviteId: "invite-1",
    });

    expect(result).toEqual({ ok: false, reason: "INVITE_NOT_FOUND" });
    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns INVITE_NOT_FOUND when inviteId is blank", async () => {
    const result = await revokeInvite({
      actorUserId: "actor-1",
      inviteId: "   ",
    });

    expect(result).toEqual({ ok: false, reason: "INVITE_NOT_FOUND" });
    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns INVITE_NOT_FOUND when target invite does not exist", async () => {
    mocks.findUniqueMock.mockResolvedValue(null);

    const result = await revokeInvite({
      actorUserId: "actor-1",
      inviteId: "invite-1",
    });

    expect(result).toEqual({ ok: false, reason: "INVITE_NOT_FOUND" });
    expect(mocks.getActiveMembershipMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns INVITE_NOT_FOUND when target invite is not pending", async () => {
    mocks.findUniqueMock.mockResolvedValue({
      id: "invite-1",
      companyId: "company-1",
      email: "user@example.com",
      role: "USER",
      status: "REVOKED",
    });

    const result = await revokeInvite({
      actorUserId: "actor-1",
      inviteId: "invite-1",
    });

    expect(result).toEqual({ ok: false, reason: "INVITE_NOT_FOUND" });
    expect(mocks.getActiveMembershipMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN when actor has no active membership in invite company", async () => {
    mocks.getActiveMembershipMock.mockResolvedValue(null);

    const result = await revokeInvite({
      actorUserId: "actor-1",
      inviteId: "invite-1",
    });

    expect(result).toEqual({ ok: false, reason: "FORBIDDEN" });

    expect(mocks.getActiveMembershipMock).toHaveBeenCalledWith({
      userId: "actor-1",
      companyId: "company-1",
    });

    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN when actor role is USER", async () => {
    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "actor-1",
      companyId: "company-1",
      role: "USER",
      status: "ACTIVE",
    });

    const result = await revokeInvite({
      actorUserId: "actor-1",
      inviteId: "invite-1",
    });

    expect(result).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN when ADMIN tries to revoke OWNER invite", async () => {
    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "actor-1",
      companyId: "company-1",
      role: "ADMIN",
      status: "ACTIVE",
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "invite-1",
      companyId: "company-1",
      email: "owner@example.com",
      role: "OWNER",
      status: "PENDING",
    });

    const result = await revokeInvite({
      actorUserId: "actor-1",
      inviteId: "invite-1",
    });

    expect(result).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns ok true, revokes invite, and logs INVITE_REVOKED", async () => {
    const result = await revokeInvite({
      actorUserId: "actor-1",
      inviteId: "invite-1",
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result).toEqual({ ok: true });

    expect(mocks.findUniqueMock).toHaveBeenCalledWith({
      where: {
        id: "invite-1",
      },
      select: {
        id: true,
        companyId: true,
        email: true,
        role: true,
        status: true,
      },
    });

    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "invite-1",
        status: "PENDING",
      },
      data: {
        status: "REVOKED",
        revokedAt: expect.any(Date),
      },
    });

    expect(mocks.logAuthEventMock).toHaveBeenCalledWith({
      type: AuthEventType.INVITE_REVOKED,
      userId: "actor-1",
      companyId: "company-1",
      email: "user@example.com",
      ip: "127.0.0.1",
      userAgent: "vitest",
      meta: {
        inviteId: "invite-1",
        role: "USER",
        actorUserId: "actor-1",
      },
    });
  });
});
