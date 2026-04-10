import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  canCreateOrdersMock: vi.fn(),
  getBookingCatalogMock: vi.fn(),
  buildOrderSummariesMock: vi.fn(),
  buildOrderItemsFromCardsMock: vi.fn(),
  sendOrderNotificationEmailMock: vi.fn(),
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

vi.mock("@/lib/orders/orderNotificationEmail", () => ({
  sendOrderNotificationEmail: mocks.sendOrderNotificationEmailMock,
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
    mocks.buildOrderItemsFromCardsMock.mockReturnValue([]);
    mocks.getBookingCatalogMock.mockResolvedValue({
      products: [],
      specialOptions: [],
    });
    mocks.pendingFindManyMock.mockResolvedValue([]);
    mocks.pendingDeleteManyMock.mockResolvedValue({ count: 0 });
    mocks.orderCreateMock.mockResolvedValue({
      id: "order-1",
      displayId: 20000,
      orderNumber: "PO-1",
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    mocks.transactionMock.mockImplementation(async (callback: any) =>
      callback({
        companyOrderCounter: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ companyId: "company-1", nextNumber: 20001 }),
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

  it("GET scopes order creators to their own membership and returns mapped rows", async () => {
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
        status: "behandles",
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
      new Request("http://localhost/api/orders?search=Acme&page=2&rowsPerPage=10"),
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
          customerMembershipId: "membership-1",
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
          status: "behandles",
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
});
