import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    getActiveMembershipMock: vi.fn(),
    priceListFindUniqueMock: vi.fn(),
    transactionMock: vi.fn(),
    hashPasswordMock: vi.fn(),
    userFindUniqueMock: vi.fn(),
    userCreateMock: vi.fn(),
    membershipFindUniqueMock: vi.fn(),
    membershipCreateMock: vi.fn(),
    inviteUpdateManyMock: vi.fn(),
    membershipPermissionCreateManyMock: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    priceList: {
      findUnique: mocks.priceListFindUniqueMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

vi.mock("@/lib/auth/membership", () => ({
  getActiveMembership: mocks.getActiveMembershipMock,
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: mocks.hashPasswordMock,
}));

import { createUserWithPassword } from "./userCreate";

describe("createUserWithPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "actor-1",
      companyId: "company-1",
      role: "OWNER",
      status: "ACTIVE",
    });

    mocks.priceListFindUniqueMock.mockResolvedValue({ id: "price-list-1" });
    mocks.hashPasswordMock.mockResolvedValue("hashed-password");
    mocks.userFindUniqueMock.mockResolvedValue(null);
    mocks.userCreateMock.mockResolvedValue({ id: "user-1" });
    mocks.membershipFindUniqueMock.mockResolvedValue(null);
    mocks.membershipCreateMock.mockResolvedValue({ id: "membership-1" });
    mocks.inviteUpdateManyMock.mockResolvedValue({ count: 0 });
    mocks.membershipPermissionCreateManyMock.mockResolvedValue({ count: 0 });

    mocks.transactionMock.mockImplementation(async (callback) => {
      return callback({
        user: {
          findUnique: mocks.userFindUniqueMock,
          create: mocks.userCreateMock,
        },
        membership: {
          findUnique: mocks.membershipFindUniqueMock,
          create: mocks.membershipCreateMock,
        },
        invite: {
          updateMany: mocks.inviteUpdateManyMock,
        },
        membershipPermission: {
          createMany: mocks.membershipPermissionCreateManyMock,
        },
      });
    });
  });

  it("returns INVALID_INPUT when password is too short", async () => {
    const result = await createUserWithPassword({
      actorUserId: "actor-1",
      companyId: "company-1",
      email: "user@example.com",
      role: "USER",
      password: "short",
    });

    expect(result).toEqual({ ok: false, reason: "INVALID_INPUT" });
    expect(mocks.hashPasswordMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN when ADMIN tries to create an OWNER", async () => {
    mocks.getActiveMembershipMock.mockResolvedValueOnce({
      userId: "actor-1",
      companyId: "company-1",
      role: "ADMIN",
      status: "ACTIVE",
    });

    const result = await createUserWithPassword({
      actorUserId: "actor-1",
      companyId: "company-1",
      email: "user@example.com",
      role: "OWNER",
      password: "password123",
    });

    expect(result).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(mocks.hashPasswordMock).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("returns EMAIL_ALREADY_EXISTS when email is already used by another account", async () => {
    mocks.userFindUniqueMock.mockResolvedValueOnce({ id: "user-existing" });
    mocks.membershipFindUniqueMock.mockResolvedValueOnce(null);

    const result = await createUserWithPassword({
      actorUserId: "actor-1",
      companyId: "company-1",
      email: "existing@example.com",
      role: "USER",
      password: "password123",
    });

    expect(result).toEqual({ ok: false, reason: "EMAIL_ALREADY_EXISTS" });
    expect(mocks.userCreateMock).not.toHaveBeenCalled();
    expect(mocks.membershipCreateMock).not.toHaveBeenCalled();
  });

  it("returns EMAIL_ALREADY_MEMBER when email already belongs to the company", async () => {
    mocks.userFindUniqueMock.mockResolvedValueOnce({ id: "user-existing" });
    mocks.membershipFindUniqueMock.mockResolvedValueOnce({
      id: "membership-existing",
    });

    const result = await createUserWithPassword({
      actorUserId: "actor-1",
      companyId: "company-1",
      email: "existing@example.com",
      role: "USER",
      password: "password123",
    });

    expect(result).toEqual({ ok: false, reason: "EMAIL_ALREADY_MEMBER" });
    expect(mocks.userCreateMock).not.toHaveBeenCalled();
  });

  it("creates the user, revokes pending invites, and stores permissions", async () => {
    const result = await createUserWithPassword({
      actorUserId: "actor-1",
      companyId: "company-1",
      email: " User@Example.com ",
      role: "USER",
      password: "password123",
      username: "New User",
      phoneNumber: "12345",
      address: "Street 1",
      description: "Desc",
      logoPath: "/uploads/user-logos/actor-1/logo.webp",
      usernameDisplayColor: "#112233",
      priceListId: "price-list-1",
      permissions: ["BOOKING_CREATE"],
    });

    expect(result).toEqual({
      ok: true,
      userId: "user-1",
      membershipId: "membership-1",
    });

    expect(mocks.hashPasswordMock).toHaveBeenCalledWith("password123");
    expect(mocks.userCreateMock).toHaveBeenCalledWith({
      data: {
        email: "user@example.com",
        username: "New User",
        phoneNumber: "12345",
        address: "Street 1",
        description: "Desc",
        logoPath: "/uploads/user-logos/actor-1/logo.webp",
        usernameDisplayColor: "#112233",
        passwordHash: "hashed-password",
        status: "ACTIVE",
      },
      select: { id: true },
    });

    expect(mocks.inviteUpdateManyMock).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
        email: "user@example.com",
        status: "PENDING",
      },
      data: {
        status: "REVOKED",
        revokedAt: expect.any(Date),
      },
    });

    expect(mocks.membershipCreateMock).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        companyId: "company-1",
        role: "USER",
        status: "ACTIVE",
        priceListId: "price-list-1",
      },
      select: { id: true },
    });

    expect(mocks.membershipPermissionCreateManyMock).toHaveBeenCalledWith({
      data: [
        {
          membershipId: "membership-1",
          permission: "BOOKING_VIEW",
        },
        {
          membershipId: "membership-1",
          permission: "BOOKING_CREATE",
        },
      ],
    });
  });
});
