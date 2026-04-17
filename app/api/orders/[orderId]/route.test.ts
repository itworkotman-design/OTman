import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  canEditOrdersMock: vi.fn(),
  getBookingCatalogMock: vi.fn(),
  buildOrderSummariesMock: vi.fn(),
  buildOrderItemsFromCardsMock: vi.fn(),
  buildOrderEventSnapshotMock: vi.fn(),
  diffOrderEventSnapshotsMock: vi.fn(),
  createOrderStatusChangedEventMock: vi.fn(),
  createOrderUpdatedEventMock: vi.fn(),
  sendOrderNotificationEmailMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  orderDeleteManyMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/users/orderAccess", () => ({
  canEditOrders: mocks.canEditOrdersMock,
}));

vi.mock("@/lib/orders/buildOrderSummaries", () => ({
  buildOrderSummaries: mocks.buildOrderSummariesMock,
}));

vi.mock("@/lib/orders/buildOrderItemsFromCards", () => ({
  buildOrderItemsFromCards: mocks.buildOrderItemsFromCardsMock,
}));

vi.mock("@/lib/booking/catalog/getBookingCatalog", () => ({
  getBookingCatalog: mocks.getBookingCatalogMock,
}));

vi.mock("@/lib/orders/orderEvents", () => ({
  buildOrderEventSnapshot: mocks.buildOrderEventSnapshotMock,
  diffOrderEventSnapshots: mocks.diffOrderEventSnapshotsMock,
  createOrderStatusChangedEvent: mocks.createOrderStatusChangedEventMock,
  createOrderUpdatedEvent: mocks.createOrderUpdatedEventMock,
}));

vi.mock("@/lib/orders/orderNotificationEmail", () => ({
  sendOrderNotificationEmail: mocks.sendOrderNotificationEmailMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
    },
    order: {
      findFirst: mocks.orderFindFirstMock,
      deleteMany: mocks.orderDeleteManyMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { DELETE, GET, PATCH } from "./route";

describe("routes in /api/orders/[orderId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canEditOrdersMock.mockReturnValue(true);
    mocks.getBookingCatalogMock.mockResolvedValue({
      products: [],
      specialOptions: [],
    });
    mocks.buildOrderSummariesMock.mockReturnValue({
      productsSummary: "Product summary",
      deliveryTypeSummary: "Delivery summary",
      servicesSummary: "Service summary",
    });
    mocks.buildOrderEventSnapshotMock.mockImplementation((value) => value);
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([]);
    mocks.createOrderStatusChangedEventMock.mockResolvedValue(undefined);
    mocks.createOrderUpdatedEventMock.mockResolvedValue(undefined);
    mocks.buildOrderItemsFromCardsMock.mockReturnValue([]);
    mocks.orderUpdateMock.mockResolvedValue({ id: "order-1" });
    mocks.transactionMock.mockImplementation(async (callback: any) =>
      callback({
        order: {
          update: mocks.orderUpdateMock,
        },
        orderItem: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockResolvedValue({ id: "item-1" }),
        },
      }),
    );
  });

  it("GET returns 404 when the order does not exist", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.orderFindFirstMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/orders/order-1"), {
      params: Promise.resolve({ orderId: "order-1" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });
  });

  it("PATCH returns 400 when product cards are missing", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
      priceListId: "price-list-1",
      user: {
        username: "admin",
        email: "admin@example.com",
      },
      permissions: [{ permission: "BOOKING_CREATE" }],
    });

    const res = await PATCH(
      new Request("http://localhost/api/orders/order-1", {
        method: "PATCH",
        body: JSON.stringify({ productCards: [] }),
      }),
      { params: Promise.resolve({ orderId: "order-1" }) },
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_PRODUCT_CARDS",
    });
  });

  it("PATCH returns 400 when an optional phone is invalid", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
      priceListId: "price-list-1",
      user: {
        username: "admin",
        email: "admin@example.com",
      },
      permissions: [{ permission: "BOOKING_CREATE" }],
    });
    mocks.orderFindFirstMock.mockResolvedValue({
      id: "order-1",
      companyId: "company-1",
      displayId: 20001,
      orderNumber: "11191323551",
      productCardsSnapshot: [],
      priceListId: "price-list-1",
      customerMembershipId: "membership-2",
      customerLabel: "POWER Slependen",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      status: "behandles",
      statusNotes: "",
      customerName: "",
      deliveryDate: "",
      timeWindow: "",
      pickupAddress: "",
      extraPickupAddress: [],
      deliveryAddress: "",
      returnAddress: "",
      drivingDistance: "",
      phone: "",
      phoneTwo: "",
      email: "",
      customerComments: "",
      description: "",
      productsSummary: "",
      deliveryTypeSummary: "",
      servicesSummary: "",
      cashierName: "",
      cashierPhone: "",
      subcontractor: "",
      driver: "",
      secondDriver: "",
      driverInfo: "",
      licensePlate: "",
      deviation: "",
      feeExtraWork: false,
      feeAddToOrder: false,
      dontSendEmail: false,
      priceExVat: 0,
      priceSubcontractor: 0,
      rabatt: "",
      leggTil: "",
      subcontractorMinus: "",
      subcontractorPlus: "",
      gsmLastTaskState: null,
    });

    const res = await PATCH(
      new Request("http://localhost/api/orders/order-1", {
        method: "PATCH",
        body: JSON.stringify({
          productCards: [{ cardId: 1, productId: "product-1" }],
          phone: "abc123",
        }),
      }),
      { params: Promise.resolve({ orderId: "order-1" }) },
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_PHONE",
      message: "Phone number contains invalid characters.",
    });
  });

  it("PATCH sends an internal notification email after a successful update", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
      priceListId: "price-list-1",
      user: {
        username: "admin",
        email: "admin@example.com",
      },
      permissions: [{ permission: "BOOKING_CREATE" }],
    });
    mocks.orderFindFirstMock.mockResolvedValue({
      id: "order-1",
      displayId: 20001,
      orderNumber: "11191323551",
      priceListId: "price-list-1",
      customerMembershipId: "membership-2",
      customerLabel: "POWER Slependen",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    mocks.buildOrderItemsFromCardsMock.mockReturnValue([
      {
        cardId: 1,
        productId: "product-1",
        productCode: "PROD-1",
        productName: "Kjoleskap/ Kombiskap",
        deliveryType: "Innbaering",
        itemType: "EXTRA_OPTION",
        optionId: "option-1",
        optionCode: "INDOOR",
        optionLabel: "Innbaering",
        quantity: 1,
        customerPriceCents: 66900,
        subcontractorPriceCents: 0,
      },
    ]);

    const res = await PATCH(
      new Request("http://localhost/api/orders/order-1", {
        method: "PATCH",
        body: JSON.stringify({
          productCards: [{ cardId: 1, productId: "product-1" }],
          customerLabel: "POWER Slependen",
          orderNumber: "11191323551",
          status: "ferdig",
          priceExVat: 1019,
        }),
      }),
      { params: Promise.resolve({ orderId: "order-1" }) },
    );

    expect(res.status).toBe(200);
    expect(mocks.sendOrderNotificationEmailMock).toHaveBeenCalledTimes(1);
    expect(mocks.sendOrderNotificationEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "updated",
        order: expect.objectContaining({
          orderNumber: "11191323551",
          customerLabel: "POWER Slependen",
          status: "ferdig",
        }),
      }),
    );
  });

  it("PATCH stores custom-time contact fields when requested", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
      priceListId: "price-list-1",
      user: {
        username: "admin",
        email: "admin@example.com",
      },
      permissions: [{ permission: "BOOKING_CREATE" }],
    });
    mocks.orderFindFirstMock.mockResolvedValue({
      id: "order-1",
      companyId: "company-1",
      displayId: 20001,
      orderNumber: "11191323551",
      productCardsSnapshot: [],
      priceListId: "price-list-1",
      customerMembershipId: "membership-2",
      customerLabel: "POWER Slependen",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      status: "behandles",
      statusNotes: "",
      customerName: "",
      deliveryDate: "",
      timeWindow: "",
      expressDelivery: false,
      contactCustomerForCustomTimeWindow: false,
      customTimeContactNote: null,
      pickupAddress: "",
      extraPickupAddress: [],
      deliveryAddress: "",
      returnAddress: "",
      drivingDistance: "",
      phone: "",
      phoneTwo: "",
      email: "",
      customerComments: "",
      description: "",
      productsSummary: "",
      deliveryTypeSummary: "",
      servicesSummary: "",
      cashierName: "",
      cashierPhone: "",
      subcontractor: "",
      driver: "",
      secondDriver: "",
      driverInfo: "",
      licensePlate: "",
      deviation: "",
      feeExtraWork: false,
      feeAddToOrder: false,
      dontSendEmail: false,
      priceExVat: 0,
      priceSubcontractor: 0,
      rabatt: "",
      leggTil: "",
      subcontractorMinus: "",
      subcontractorPlus: "",
      gsmLastTaskState: null,
    });

    const res = await PATCH(
      new Request("http://localhost/api/orders/order-1", {
        method: "PATCH",
        body: JSON.stringify({
          productCards: [{ cardId: 1, productId: "product-1" }],
          contactCustomerForCustomTimeWindow: true,
          customTimeContactNote: "Call and confirm evening slot.",
        }),
      }),
      { params: Promise.resolve({ orderId: "order-1" }) },
    );

    expect(res.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactCustomerForCustomTimeWindow: true,
          customTimeContactNote: "Call and confirm evening slot.",
        }),
      }),
    );
  });

  it("PATCH clears the custom-time contact note when the checkbox is turned off", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
      priceListId: "price-list-1",
      user: {
        username: "admin",
        email: "admin@example.com",
      },
      permissions: [{ permission: "BOOKING_CREATE" }],
    });
    mocks.orderFindFirstMock.mockResolvedValue({
      id: "order-1",
      companyId: "company-1",
      displayId: 20001,
      orderNumber: "11191323551",
      productCardsSnapshot: [],
      priceListId: "price-list-1",
      customerMembershipId: "membership-2",
      customerLabel: "POWER Slependen",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      status: "behandles",
      statusNotes: "",
      customerName: "",
      deliveryDate: "",
      timeWindow: "",
      expressDelivery: false,
      contactCustomerForCustomTimeWindow: true,
      customTimeContactNote: "Existing note",
      pickupAddress: "",
      extraPickupAddress: [],
      deliveryAddress: "",
      returnAddress: "",
      drivingDistance: "",
      phone: "",
      phoneTwo: "",
      email: "",
      customerComments: "",
      description: "",
      productsSummary: "",
      deliveryTypeSummary: "",
      servicesSummary: "",
      cashierName: "",
      cashierPhone: "",
      subcontractor: "",
      driver: "",
      secondDriver: "",
      driverInfo: "",
      licensePlate: "",
      deviation: "",
      feeExtraWork: false,
      feeAddToOrder: false,
      dontSendEmail: false,
      priceExVat: 0,
      priceSubcontractor: 0,
      rabatt: "",
      leggTil: "",
      subcontractorMinus: "",
      subcontractorPlus: "",
      gsmLastTaskState: null,
    });

    const res = await PATCH(
      new Request("http://localhost/api/orders/order-1", {
        method: "PATCH",
        body: JSON.stringify({
          productCards: [{ cardId: 1, productId: "product-1" }],
          contactCustomerForCustomTimeWindow: false,
          customTimeContactNote: "",
        }),
      }),
      { params: Promise.resolve({ orderId: "order-1" }) },
    );

    expect(res.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactCustomerForCustomTimeWindow: false,
          customTimeContactNote: null,
        }),
      }),
    );
    expect(mocks.buildOrderEventSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contactCustomerForCustomTimeWindow: false,
        customTimeContactNote: null,
      }),
    );
  });

  it("DELETE returns 404 when no order row is removed", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "OWNER" });
    mocks.orderDeleteManyMock.mockResolvedValue({ count: 0 });

    const res = await DELETE(new Request("http://localhost/api/orders/order-1"), {
      params: Promise.resolve({ orderId: "order-1" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "ORDER_NOT_FOUND",
    });
  });
});
