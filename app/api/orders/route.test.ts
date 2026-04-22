import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  canCreateOrdersMock: vi.fn(),
  getBookingCatalogMock: vi.fn(),
  buildOrderSummariesMock: vi.fn(),
  buildOrderItemsFromCardsMock: vi.fn(),
  buildOrderEventSnapshotMock: vi.fn(),
  createOrderCreatedEventMock: vi.fn(),
  sendOrderNotificationEmailMock: vi.fn(),
  sendExtraPickupNotificationEmailMock: vi.fn(),
  createOrderNotificationMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  orderCreateMock: vi.fn(),
  orderItemCreateManyMock: vi.fn(),
  pendingFindManyMock: vi.fn(),
  orderAttachmentCreateMock: vi.fn(),
  pendingDeleteManyMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/users/orderAccess", () => ({
  canCreateOrders: mocks.canCreateOrdersMock,
}));

vi.mock("@/lib/booking/catalog/getBookingCatalog", () => ({
  getBookingCatalog: mocks.getBookingCatalogMock,
}));

vi.mock("@/lib/orders/buildOrderSummaries", () => ({
  buildOrderSummaries: mocks.buildOrderSummariesMock,
}));

vi.mock("@/lib/orders/buildOrderItemsFromCards", () => ({
  buildOrderItemsFromCards: mocks.buildOrderItemsFromCardsMock,
}));

vi.mock("@/lib/orders/orderEvents", () => ({
  buildOrderEventSnapshot: mocks.buildOrderEventSnapshotMock,
  createOrderCreatedEvent: mocks.createOrderCreatedEventMock,
}));

vi.mock("@/lib/orders/orderNotificationEmail", () => ({
  sendOrderNotificationEmail: mocks.sendOrderNotificationEmailMock,
  sendExtraPickupNotificationEmail: mocks.sendExtraPickupNotificationEmailMock,
}));

vi.mock("@/lib/orders/orderNotifications", () => ({
  createOrderNotification: mocks.createOrderNotificationMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
    },
    order: {
      findMany: mocks.orderFindManyMock,
      create: mocks.orderCreateMock,
    },
    orderItem: {
      createMany: mocks.orderItemCreateManyMock,
    },
    pendingOrderAttachment: {
      findMany: mocks.pendingFindManyMock,
      deleteMany: mocks.pendingDeleteManyMock,
    },
    orderAttachment: {
      create: mocks.orderAttachmentCreateMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { GET, POST } from "./route";

describe("routes in /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canCreateOrdersMock.mockReturnValue(true);
    mocks.buildOrderSummariesMock.mockReturnValue({
      productsSummary: "Product summary",
      deliveryTypeSummary: "Delivery summary",
      servicesSummary: "Service summary",
    });
    mocks.buildOrderEventSnapshotMock.mockReturnValue({
      status: "processing",
      statusNotes: "",
    });
    mocks.createOrderCreatedEventMock.mockResolvedValue(undefined);
    mocks.createOrderNotificationMock.mockResolvedValue({
      id: "notification-1",
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    mocks.buildOrderItemsFromCardsMock.mockReturnValue([]);
    mocks.getBookingCatalogMock.mockResolvedValue({
      products: [],
      specialOptions: [],
    });
    mocks.pendingFindManyMock.mockResolvedValue([]);
    mocks.pendingDeleteManyMock.mockResolvedValue({ count: 0 });
    mocks.orderCreateMock.mockResolvedValue({
      id: "order-1",
      companyId: "company-1",
      displayId: 20000,
      orderNumber: "PO-1",
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    mocks.transactionMock.mockImplementation(async (callback: any) =>
      callback({
        companyOrderCounter: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi
            .fn()
            .mockResolvedValue({ companyId: "company-1", nextNumber: 20001 }),
          update: vi.fn(),
        },
      }),
    );
  });

  it("GET returns 401 when the user is not authenticated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/orders"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });
  });

  it("GET scopes order creators to their customer or creator membership and returns mapped rows", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "USER",
      permissions: [{ permission: "BOOKING_CREATE" }],
    });
    mocks.orderFindManyMock.mockResolvedValue([
      {
        id: "order-1",
        displayId: 20001,
        status: "processing",
        statusNotes: null,
        deliveryDate: "2030-01-15",
        timeWindow: "08-12",
        customerLabel: "Acme",
        customerName: "Alice",
        orderNumber: "PO-1",
        phone: "12345678",
        pickupAddress: "Pickup 1",
        extraPickupAddress: ["Pickup 2"],
        deliveryAddress: "Delivery 1",
        returnAddress: null,
        productsSummary: "Van",
        deliveryTypeSummary: "Standard",
        servicesSummary: "Carry",
        description: null,
        cashierName: null,
        cashierPhone: null,
        customerComments: null,
        driverInfo: null,
        subcontractorMembershipId: null,
        subcontractor: null,
        driver: null,
        createdAt: new Date("2030-01-01T00:00:00.000Z"),
        updatedAt: new Date("2030-01-02T00:00:00.000Z"),
        priceExVat: 1000,
        priceSubcontractor: 700,
        createdByMembershipId: "membership-1",
        lastEditedByMembershipId: null,
        customerMembershipId: "membership-1",
        createdByMembership: {
          user: {
            username: "creator",
            email: "creator@example.com",
          },
        },
        lastEditedByMembership: null,
      },
    ]);

    const res = await GET(
      new Request(
        "http://localhost/api/orders?search=Acme&page=2&rowsPerPage=10",
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      orders: [
        expect.objectContaining({
          id: "order-1",
          customer: "Acme",
          createdBy: "creator",
          lastEditedBy: "",
        }),
      ],
      page: 2,
      rowsPerPage: 10,
    });
    expect(mocks.orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-1",
          OR: [
            { customerMembershipId: "membership-1" },
            { createdByMembershipId: "membership-1" },
          ],
        }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it("POST returns 400 when product cards are missing", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "USER",
      priceListId: "price-list-1",
      user: {
        username: "creator",
        email: "creator@example.com",
      },
      permissions: [{ permission: "BOOKING_CREATE" }],
    });

    const res = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({ productCards: [] }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_PRODUCT_CARDS",
    });
  });

  it("POST returns 400 when an optional email is invalid", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "USER",
      priceListId: "price-list-1",
      user: {
        username: "creator",
        email: "creator@example.com",
      },
      permissions: [{ permission: "BOOKING_CREATE" }],
    });

    const res = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          productCards: [{ cardId: 1, productId: "product-1" }],
          email: "not-an-email",
        }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_EMAIL",
      message: "Enter a valid email address.",
    });
  });

  it("POST returns 400 when an extra pickup has no phone or email", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "USER",
      priceListId: "price-list-1",
      user: {
        username: "creator",
        email: "creator@example.com",
      },
      permissions: [{ permission: "BOOKING_CREATE" }],
    });

    const res = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          productCards: [{ cardId: 1, productId: "product-1" }],
          extraPickups: [{ address: "Store 2", phone: "+47", email: "" }],
        }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_EXTRA_PICKUP_CONTACT",
      message: "Extra pickup 1 needs a phone number or email address.",
    });
  });

  it("POST removes spaces from phone values before saving", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "USER",
      priceListId: "price-list-1",
      user: {
        username: "creator",
        email: "creator@example.com",
      },
      permissions: [{ permission: "BOOKING_CREATE" }],
    });

    const res = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          productCards: [{ cardId: 1, productId: "product-1" }],
          phone: "+47 98 76 54 32",
          phoneTwo: "12 34 56 78",
          cashierPhone: "90 12 34 56",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.orderCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: "+4798765432",
          phoneTwo: "12345678",
          cashierPhone: "90123456",
        }),
      }),
    );
  });

  it("POST treats a bare +47 prefix as an empty optional phone field", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "USER",
      priceListId: "price-list-1",
      user: {
        username: "creator",
        email: "creator@example.com",
      },
      permissions: [{ permission: "BOOKING_CREATE" }],
    });

    const res = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          productCards: [{ cardId: 1, productId: "product-1" }],
          phone: "+47",
          phoneTwo: "+47",
          cashierPhone: "+47",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.orderCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: null,
          phoneTwo: null,
          cashierPhone: null,
        }),
      }),
    );
  });

  it("POST stores custom-time contact fields when requested", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "USER",
      priceListId: "price-list-1",
      user: {
        username: "creator",
        email: "creator@example.com",
      },
      permissions: [{ permission: "BOOKING_CREATE" }],
    });

    const res = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          productCards: [{ cardId: 1, productId: "product-1" }],
          timeWindow: "08:30-10:00",
          contactCustomerForCustomTimeWindow: true,
          customTimeContactNote: "Call before confirming arrival window.",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.orderCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactCustomerForCustomTimeWindow: true,
          customTimeContactNote: "Call before confirming arrival window.",
        }),
      }),
    );
  });

  it("POST sends an internal notification email after a successful create", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "USER",
      priceListId: "price-list-1",
      user: {
        username: "Power Grunerlokka",
        email: "power@example.com",
      },
      permissions: [{ permission: "BOOKING_CREATE" }],
    });
    mocks.buildOrderItemsFromCardsMock.mockReturnValue([
      {
        cardId: 1,
        productId: "product-1",
        productCode: "PROD-1",
        productName: "Oppvaskmaskin",
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

    const res = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          productCards: [{ cardId: 1, productId: "product-1" }],
          customerLabel: "Power Grunerlokka",
          deliveryDate: "2026-04-09",
          pickupAddress: "Pickup 1",
          deliveryAddress: "Delivery 1",
          orderNumber: "11340837806",
          priceExVat: 3699,
          status: "processing",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.sendOrderNotificationEmailMock).toHaveBeenCalledTimes(1);
    expect(mocks.sendOrderNotificationEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "created",
        order: expect.objectContaining({
          orderNumber: "PO-1",
          customerLabel: "Power Grunerlokka",
        }),
      }),
    );
  });

  it("POST skips order notification emails when company order emails are disabled", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "USER",
      priceListId: "price-list-1",
      company: {
        orderEmailsEnabled: false,
      },
      user: {
        username: "creator",
        email: "creator@example.com",
      },
      permissions: [{ permission: "BOOKING_CREATE" }],
    });

    const res = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          productCards: [{ cardId: 1, productId: "product-1" }],
          customerLabel: "Power Grunerlokka",
          deliveryDate: "2026-04-09",
          pickupAddress: "Pickup 1",
          deliveryAddress: "Delivery 1",
          orderNumber: "11340837806",
          priceExVat: 3699,
          status: "processing",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.sendOrderNotificationEmailMock).not.toHaveBeenCalled();
    expect(mocks.sendExtraPickupNotificationEmailMock).not.toHaveBeenCalled();
  });

  it("POST creates an order notification when extra pickups are present", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "USER",
      priceListId: "price-list-1",
      user: {
        username: "creator",
        email: "creator@example.com",
      },
      permissions: [{ permission: "BOOKING_CREATE" }],
    });

    const res = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          productCards: [{ cardId: 1, productId: "product-1" }],
          extraPickups: [
            {
              address: "Store 2",
              phone: "+47 98 76 54 32",
              email: "",
              sendEmail: false,
            },
          ],
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.createOrderNotificationMock).toHaveBeenCalledTimes(1);
    expect(mocks.createOrderNotificationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderId: "order-1",
        companyId: "company-1",
        type: "MANUAL_REVIEW",
        title: "Extra pickup notification",
        message: expect.stringContaining(
          "Please contact store for extra pickup.",
        ),
      }),
    );
  });

  it("POST preserves pending attachment categories when creating order attachments", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "USER",
      priceListId: "price-list-1",
      user: {
        username: "creator",
        email: "creator@example.com",
      },
      permissions: [{ permission: "BOOKING_CREATE" }],
    });
    mocks.pendingFindManyMock.mockResolvedValue([
      {
        id: "pending-1",
        category: "RECEIPT",
        filename: "receipt.pdf",
        mimeType: "application/pdf",
        sizeBytes: 42,
        storagePath: "/uploads/pending-orders/user-1/receipt.pdf",
      },
    ]);

    const res = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          productCards: [{ cardId: 1, productId: "product-1" }],
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.orderAttachmentCreateMock).toHaveBeenCalledWith({
      data: {
        orderId: "order-1",
        category: "RECEIPT",
        filename: "receipt.pdf",
        mimeType: "application/pdf",
        sizeBytes: 42,
        storagePath: "/uploads/pending-orders/user-1/receipt.pdf",
      },
    });
  });
});
