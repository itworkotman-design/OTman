import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  transactionMock: vi.fn(),
  txOrderFindManyMock: vi.fn(),
  txOrderCreateMock: vi.fn(),
  txOrderItemCreateManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/orders/orderNumber", () => ({
  reserveNextManualOrderNumber: vi.fn().mockResolvedValue(30001),
}));

vi.mock("@/lib/orders/orderEvents", () => ({
  buildOrderEventSnapshot: vi.fn().mockReturnValue({}),
  createOrderCreatedEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
    },
    order: {
      findMany: mocks.orderFindManyMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { POST } from "./route";

describe("POST /api/orders/duplicate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when no order ids are supplied", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "ADMIN" });

    const res = await POST(
      new Request("http://localhost/api/orders/duplicate", {
        method: "POST",
        body: JSON.stringify({ orderIds: [] }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_ORDER_IDS",
    });
  });

  it("returns 404 when the requested source orders are missing", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "OWNER" });
    mocks.orderFindManyMock.mockResolvedValue([]);

    const res = await POST(
      new Request("http://localhost/api/orders/duplicate", {
        method: "POST",
        body: JSON.stringify({ orderIds: ["order-1"] }),
      }),
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "ORDERS_NOT_FOUND",
    });
  });

  it("copies the saved pickup/return locations, coordinates and extra pickup contacts", async () => {
    const extraPickupContacts = [
      {
        address: "Extra 1",
        phone: "12345678",
        email: "",
        sendEmail: true,
        customPickupAddressId: "cpa-2",
        customPickupAddressName: "Power Lager",
        latitude: 59.5,
        longitude: 10.4,
      },
    ];

    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
      user: { username: "admin", email: "admin@example.com" },
    });
    mocks.orderFindManyMock.mockResolvedValue([
      {
        id: "order-1",
        companyId: "company-1",
        orderNumber: "PO-1",
        items: [],
        productCardsSnapshot: [],
        pickupAddress: "Storo Storsenter 1, 0587 Oslo",
        customPickupAddressId: "cpa-1",
        customPickupAddressName: "Power Storo",
        customPickupAddressPhone: "99999999",
        pickupLatitude: 59.945,
        pickupLongitude: 10.7669,
        extraPickupAddress: ["Extra 1"],
        extraPickupContacts,
        deliveryAddress: "Delivery 1",
        deliveryLatitude: 59.8,
        deliveryLongitude: 10.6,
        returnAddress: "Return 1",
        customReturnAddressId: "cra-1",
        customReturnAddressName: "Power Retur",
        customReturnAddressPhone: "88888888",
        returnLatitude: 59.7,
        returnLongitude: 10.5,
      },
    ]);
    mocks.txOrderFindManyMock.mockResolvedValue([]);
    mocks.txOrderCreateMock.mockResolvedValue({ id: "order-2", companyId: "company-1", createdAt: new Date() });
    mocks.transactionMock.mockImplementation(async (callback) =>
      callback({
        order: { findMany: mocks.txOrderFindManyMock, create: mocks.txOrderCreateMock },
        orderItem: { createMany: mocks.txOrderItemCreateManyMock },
      }),
    );

    const res = await POST(
      new Request("http://localhost/api/orders/duplicate", {
        method: "POST",
        body: JSON.stringify({ orderIds: ["order-1"] }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.txOrderCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pickupAddress: "Storo Storsenter 1, 0587 Oslo",
          customPickupAddressId: "cpa-1",
          customPickupAddressName: "Power Storo",
          customPickupAddressPhone: "99999999",
          pickupLatitude: 59.945,
          pickupLongitude: 10.7669,
          extraPickupContacts,
          deliveryLatitude: 59.8,
          deliveryLongitude: 10.6,
          customReturnAddressId: "cra-1",
          customReturnAddressName: "Power Retur",
          customReturnAddressPhone: "88888888",
          returnLatitude: 59.7,
          returnLongitude: 10.5,
        }),
      }),
    );
  });
});
