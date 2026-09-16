import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  requireFullAccessMembershipMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  transactionMock: vi.fn(),
  deleteManyMock: vi.fn(),
  createManyMock: vi.fn(),
  userFindManyMock: vi.fn(),
  userUpdateManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/products/pricelistAccess", () => ({
  requireFullAccessMembership: mocks.requireFullAccessMembershipMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    customPickupAddress: {
      findUnique: mocks.findUniqueMock,
      update: mocks.updateMock,
    },
    userCustomPickupAddress: {
      deleteMany: mocks.deleteManyMock,
      createMany: mocks.createManyMock,
    },
    user: {
      findMany: mocks.userFindManyMock,
      updateMany: mocks.userUpdateManyMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { NextResponse } from "next/server";
import { GET, PATCH } from "./route";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/pickup-addresses/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when the address doesn't exist", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.findUniqueMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/pickup-addresses/cpa-1"), ctx("cpa-1"));

    expect(response.status).toBe(404);
  });

  it("returns the address with its assigned users", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.findUniqueMock.mockResolvedValue({
      id: "cpa-1",
      name: "Power Storo",
      address: "Storo Storsenter 1",
      latitude: 59.945,
      longitude: 10.7669,
      isActive: true,
      users: [
        { user: { id: "user-1", email: "a@example.com", username: "A" } },
        { user: { id: "user-2", email: "b@example.com", username: "B" } },
      ],
    });
    mocks.userFindManyMock.mockResolvedValueOnce([{ id: "user-1", email: "a@example.com", username: "A" }]);

    const response = await GET(new Request("http://localhost/api/pickup-addresses/cpa-1"), ctx("cpa-1"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.pickupAddress.users).toEqual([
      { id: "user-1", email: "a@example.com", username: "A" },
      { id: "user-2", email: "b@example.com", username: "B" },
    ]);
    expect(json.mainUsers).toEqual([{ id: "user-1", email: "a@example.com", username: "A" }]);
    expect(json.eligibleUsers).toEqual(json.pickupAddress.users);
    expect(mocks.userFindManyMock).toHaveBeenCalledWith({
      where: { mainPickupAddressId: "cpa-1" },
      select: { id: true, email: true, username: true },
    });
  });
});

describe("PATCH /api/pickup-addresses/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        customPickupAddress: { update: mocks.updateMock },
        userCustomPickupAddress: {
          deleteMany: mocks.deleteManyMock,
          createMany: mocks.createManyMock,
        },
        user: { updateMany: mocks.userUpdateManyMock },
      }),
    );
  });

  it("returns 403 when the caller lacks full access", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }),
    });

    const response = await PATCH(
      new Request("http://localhost/api/pickup-addresses/cpa-1", {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      }),
      ctx("cpa-1"),
    );

    expect(response.status).toBe(403);
  });

  it("rejects invalid coordinates on update", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });

    const response = await PATCH(
      new Request("http://localhost/api/pickup-addresses/cpa-1", {
        method: "PATCH",
        body: JSON.stringify({
          name: "Power Storo",
          address: "Addr",
          latitude: 59.9,
          longitude: 999,
        }),
      }),
      ctx("cpa-1"),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.reason).toBe("INVALID_LONGITUDE");
    expect(mocks.updateMock).not.toHaveBeenCalled();
  });

  it("soft-deletes (deactivates) via isActive: false without requiring name/address/coordinates", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.updateMock.mockResolvedValue({ id: "cpa-1" });

    const response = await PATCH(
      new Request("http://localhost/api/pickup-addresses/cpa-1", {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      }),
      ctx("cpa-1"),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateMock).toHaveBeenCalledWith({
      where: { id: "cpa-1" },
      data: { isActive: false },
    });
  });

  it("updates fields and replaces user assignments", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.updateMock.mockResolvedValue({ id: "cpa-1" });

    const response = await PATCH(
      new Request("http://localhost/api/pickup-addresses/cpa-1", {
        method: "PATCH",
        body: JSON.stringify({
          name: "Power Storo Updated",
          address: "New address",
          latitude: 1,
          longitude: 2,
          userIds: ["user-2"],
        }),
      }),
      ctx("cpa-1"),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateMock).toHaveBeenCalledWith({
      where: { id: "cpa-1" },
      data: {
        name: "Power Storo Updated",
        address: "New address",
        latitude: 1,
        longitude: 2,
        icon: "storefront",
        color: "blue",
        phone: null,
      },
    });
    expect(mocks.deleteManyMock).toHaveBeenCalledWith({ where: { customPickupAddressId: "cpa-1" } });
    expect(mocks.createManyMock).toHaveBeenCalledWith({
      data: [{ customPickupAddressId: "cpa-1", userId: "user-2" }],
    });
    expect(mocks.userUpdateManyMock).toHaveBeenCalledWith({
      where: { mainPickupAddressId: "cpa-1", id: { notIn: ["user-2"] } },
      data: { mainPickupAddressId: null },
    });
  });

  it("updates the phone number", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.updateMock.mockResolvedValue({ id: "cpa-1" });

    const response = await PATCH(
      new Request("http://localhost/api/pickup-addresses/cpa-1", {
        method: "PATCH",
        body: JSON.stringify({
          name: "Power Storo",
          address: "Storo Storsenter 1",
          latitude: 59.945,
          longitude: 10.7669,
          phone: "22 33 44 55",
        }),
      }),
      ctx("cpa-1"),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateMock).toHaveBeenCalledWith({
      where: { id: "cpa-1" },
      data: expect.objectContaining({ phone: "22334455" }),
    });
  });

  it("clears mainPickupAddressId for a user whose visibility is revoked", async () => {
    // Regression test: a user removed from "Visible to users" must also lose
    // their "main" nomination for this address, or their warehouse address
    // field stays locked read-only to an address they can no longer see.
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.updateMock.mockResolvedValue({ id: "cpa-1" });

    const response = await PATCH(
      new Request("http://localhost/api/pickup-addresses/cpa-1", {
        method: "PATCH",
        body: JSON.stringify({
          name: "Power Storo",
          address: "Storo Storsenter 1",
          latitude: 59.945,
          longitude: 10.7669,
          userIds: [],
        }),
      }),
      ctx("cpa-1"),
    );

    expect(response.status).toBe(200);
    expect(mocks.userUpdateManyMock).toHaveBeenCalledWith({
      where: { mainPickupAddressId: "cpa-1", id: { notIn: [] } },
      data: { mainPickupAddressId: null },
    });
  });

  it("does not touch mainPickupAddressId when userIds isn't part of the update", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.updateMock.mockResolvedValue({ id: "cpa-1" });

    const response = await PATCH(
      new Request("http://localhost/api/pickup-addresses/cpa-1", {
        method: "PATCH",
        body: JSON.stringify({
          name: "Power Storo",
          address: "Storo Storsenter 1",
          latitude: 59.945,
          longitude: 10.7669,
        }),
      }),
      ctx("cpa-1"),
    );

    expect(response.status).toBe(200);
    expect(mocks.deleteManyMock).not.toHaveBeenCalled();
    expect(mocks.userUpdateManyMock).not.toHaveBeenCalled();
  });
});
