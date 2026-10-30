import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  canEditOrdersMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  membershipFindManyMock: vi.fn(),
  orderFindManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/users/orderAccess", () => ({
  canEditOrders: mocks.canEditOrdersMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
      findMany: mocks.membershipFindManyMock,
    },
    order: { findMany: mocks.orderFindManyMock },
  },
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/orders/prepare-email-groups", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/orders/prepare-email-groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canEditOrdersMock.mockReturnValue(true);
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "user-1", activeCompanyId: "company-1" });
    mocks.membershipFindFirstMock.mockResolvedValue({ id: "admin-m", role: "ADMIN", permissions: [] });
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);
    const res = await POST(request({ orderIds: ["o1"] }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller cannot edit orders", async () => {
    mocks.canEditOrdersMock.mockReturnValue(false);
    const res = await POST(request({ orderIds: ["o1"] }));
    expect(res.status).toBe(403);
  });

  it("returns 400 without order ids", async () => {
    const res = await POST(request({ orderIds: [] }));
    expect(res.status).toBe(400);
  });

  it("groups each pickup stop by the pickup's main user, falling back to the store", async () => {
    mocks.orderFindManyMock.mockResolvedValue([
      {
        id: "o1",
        customPickupAddressId: "cpa-alnabru",
        customerMembershipId: null,
        createdByMembershipId: "m-storo",
        pickupAddress: "Smalvollveien 65",
        extraPickupContacts: [
          // Saved address without a main user and no own email: not sent.
          { address: "Depot 2", email: "", sendEmail: true, customPickupAddressId: "cpa-depot" },
        ],
      },
      {
        id: "o2",
        customPickupAddressId: "cpa-no-main",
        customerMembershipId: null,
        createdByMembershipId: "m-storo",
        pickupAddress: "Somewhere",
        extraPickupContacts: null,
      },
    ]);
    mocks.membershipFindManyMock.mockImplementation(async (args: { where: { id?: unknown } }) =>
      args.where.id
        ? [{ id: "m-storo", warehouseEmail: null, user: { email: "storo@power.no", username: "POWER Storo" } }]
        : [
            {
              id: "m-alnabru",
              warehouseEmail: "lager@power.no",
              user: {
                email: "alnabru@power.no",
                username: "POWER Alnabru (pickup)",
                mainPickupAddressId: "cpa-alnabru",
                mainPickupAddress: { name: "POWER Alnabru" },
              },
            },
          ],
    );

    const res = await POST(request({ orderIds: ["o1", "o2"] }));
    const json = await res.json();

    expect(mocks.orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["o1", "o2"] }, companyId: "company-1" } }),
    );
    // Pickup contacts must come from mainPickupAddress only, scoped to the company.
    expect(mocks.membershipFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: "company-1",
          status: "ACTIVE",
          user: { status: "ACTIVE", mainPickupAddressId: { in: ["cpa-alnabru", "cpa-depot", "cpa-no-main"] } },
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(json).toEqual({
      ok: true,
      groups: [
        {
          key: "pickup:cpa-alnabru",
          recipientName: "POWER Alnabru",
          recipients: [
            { email: "alnabru@power.no", name: "POWER Alnabru" },
            { email: "lager@power.no", name: "POWER Alnabru" },
          ],
          orderIds: ["o1"],
          stops: [{ orderId: "o1", pickupAddress: "Smalvollveien 65", extra: false }],
        },
        {
          key: "store:m-storo",
          recipientName: "POWER Storo",
          recipients: [{ email: "storo@power.no", name: "POWER Storo" }],
          orderIds: ["o2"],
          stops: [{ orderId: "o2", pickupAddress: "Somewhere", extra: false }],
        },
      ],
      unresolved: [{ orderId: "o1", pickupAddress: "Depot 2", extra: true }],
    });
  });
});
