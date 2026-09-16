import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  requireFullAccessMembershipMock: vi.fn(),
  findUniqueMock: vi.fn(),
  findManyAssignmentsMock: vi.fn(),
  updateManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/products/pricelistAccess", () => ({
  requireFullAccessMembership: mocks.requireFullAccessMembershipMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    customPickupAddress: { findUnique: mocks.findUniqueMock },
    userCustomPickupAddress: { findMany: mocks.findManyAssignmentsMock },
    user: { updateMany: mocks.updateManyMock },
  },
}));

import { NextResponse } from "next/server";
import { PATCH } from "./route";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/pickup-addresses/[id]/assign-users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when the caller lacks full access", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }),
    });

    const response = await PATCH(
      new Request("http://localhost/api/pickup-addresses/cpa-1/assign-users", {
        method: "PATCH",
        body: JSON.stringify({ addUserIds: ["user-1"], removeUserIds: [] }),
      }),
      ctx("cpa-1"),
    );

    expect(response.status).toBe(403);
  });

  it("returns 404 when the address doesn't exist", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.findUniqueMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/pickup-addresses/cpa-1/assign-users", {
        method: "PATCH",
        body: JSON.stringify({ addUserIds: ["user-1"], removeUserIds: [] }),
      }),
      ctx("cpa-1"),
    );

    expect(response.status).toBe(404);
  });

  it("rejects adding a user who doesn't have this address assigned", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.findUniqueMock.mockResolvedValue({ id: "cpa-1" });
    // The requested user isn't in the address's assignment list.
    mocks.findManyAssignmentsMock.mockResolvedValue([]);

    const response = await PATCH(
      new Request("http://localhost/api/pickup-addresses/cpa-1/assign-users", {
        method: "PATCH",
        body: JSON.stringify({ addUserIds: ["user-unauthorized"], removeUserIds: [] }),
      }),
      ctx("cpa-1"),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.reason).toBe("USER_NOT_ELIGIBLE");
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
  });

  it("sets mainPickupAddressId for eligible users and clears it for removed ones", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.findUniqueMock.mockResolvedValue({ id: "cpa-1" });
    mocks.findManyAssignmentsMock.mockResolvedValue([{ userId: "user-1" }]);
    mocks.updateManyMock.mockResolvedValue({ count: 1 });

    const response = await PATCH(
      new Request("http://localhost/api/pickup-addresses/cpa-1/assign-users", {
        method: "PATCH",
        body: JSON.stringify({ addUserIds: ["user-1"], removeUserIds: ["user-2"] }),
      }),
      ctx("cpa-1"),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["user-1"] } },
      data: { mainPickupAddressId: "cpa-1" },
    });
    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["user-2"] }, mainPickupAddressId: "cpa-1" },
      data: { mainPickupAddressId: null },
    });
  });
});
