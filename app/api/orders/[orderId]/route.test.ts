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
  sendExtraPickupNotificationEmailMock: vi.fn(),
  createOrderNotificationMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  priceListFindUniqueMock: vi.fn(),
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
    priceList: {
      findUnique: mocks.priceListFindUniqueMock,
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
    mocks.priceListFindUniqueMock.mockResolvedValue({
      id: "default-price-list-id",
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
    mocks.createOrderNotificationMock.mockResolvedValue({
      id: "notification-1",
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    mocks.buildOrderItemsFromCardsMock.mockReturnValue([]);
    mocks.orderUpdateMock.mockResolvedValue({ id: "order-1" });
    mocks.transactionMock.mockImplementation(async (callback) =>
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

  it("GET rebuilds legacy extra pickups from wordpress raw meta when contacts are missing", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.orderFindFirstMock.mockResolvedValue({
      id: "order-1",
      displayId: 20001,
      priceListId: "price-list-1",
      customerMembershipId: "membership-2",
      productCardsSnapshot: [],
      orderNumber: "11191323551",
      description: "",
      modelNr: "",
      deliveryDate: "2026-04-25",
      timeWindow: "10:00-16:00",
      expressDelivery: false,
      contactCustomerForCustomTimeWindow: false,
      customTimeContactNote: "",
      pickupAddress: "Pickup 1",
      extraPickupAddress: [],
      extraPickupContacts: null,
      legacyWordpressRawMeta: {
        field_68248234acd3e: [
          { field_68248274acd3f: "Pickup 2" },
          { pickup: "Pickup 3" },
        ],
      },
      deliveryAddress: "Delivery 1",
      returnAddress: "",
      drivingDistance: "",
      customerName: "Customer",
      customerLabel: "Customer",
      phone: "",
      phoneTwo: "",
      email: "",
      customerComments: "",
      floorNo: "",
      lift: "",
      cashierName: "",
      cashierPhone: "",
      subcontractorMembershipId: "",
      subcontractor: "",
      driver: "",
      secondDriver: "",
      driverInfo: "",
      licensePlate: "",
      deviation: "",
      feeExtraWork: false,
      feeAddToOrder: false,
      statusNotes: "",
      status: "processing",
      dontSendEmail: false,
      priceExVat: 0,
      priceSubcontractor: 0,
      rabatt: "",
      leggTil: "",
      subcontractorMinus: "",
      subcontractorPlus: "",
      lastEditedByMembershipId: "",
      createdByMembership: null,
      lastEditedByMembership: null,
    });

    const res = await GET(new Request("http://localhost/api/orders/order-1"), {
      params: Promise.resolve({ orderId: "order-1" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      order: {
        extraPickupAddress: ["Pickup 2", "Pickup 3"],
        extraPickups: [
          {
            address: "Pickup 2",
            phone: "",
            email: "",
            sendEmail: true,
          },
          {
            address: "Pickup 3",
            phone: "",
            email: "",
            sendEmail: true,
          },
        ],
      },
    });
  });

  it("GET rewrites saved return selections to return-to-store when a return address exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.getBookingCatalogMock.mockResolvedValueOnce({
      products: [],
      specialOptions: [
        {
          id: "return-store-id",
          type: "return",
          code: "RETURNSTORE",
          label: "Retur til butikk",
          description: "Return to store",
          customerPrice: "300",
          subcontractorPrice: "200",
          effectiveCustomerPrice: "300",
          active: true,
        },
        {
          id: "return-rec-id",
          type: "return",
          code: "RETURNREC",
          label: "Retur til gjenvinning",
          description: "Return to recycling",
          customerPrice: "250",
          subcontractorPrice: "150",
          effectiveCustomerPrice: "250",
          active: true,
        },
      ],
    });
    mocks.orderFindFirstMock.mockResolvedValue({
      id: "order-1",
      displayId: 20001,
      legacyWordpressOrderId: 3954,
      priceListId: "price-list-1",
      customerMembershipId: "membership-2",
      productCardsSnapshot: [
        {
          cardId: 1,
          productId: "product-1",
          modelNumber: "",
          deliveryType: "INDOOR",
          amount: 1,
          peopleCount: 1,
          hoursInput: 1,
          selectedInstallOptionIds: [],
          selectedExtraOptionIds: [],
          selectedReturnOptionId: "return-rec-id",
          demontEnabled: false,
          selectedTimeOptionIds: [],
          extraTimeHours: 0.5,
          extraPalletEnabled: false,
          extraPalletQty: 1,
          etterEnabled: false,
          etterQty: 1,
          customSectionSelections: [],
        },
      ],
      orderNumber: "11191323551",
      description: "",
      modelNr: "",
      deliveryDate: "2026-04-25",
      timeWindow: "",
      expressDelivery: true,
      contactCustomerForCustomTimeWindow: false,
      customTimeContactNote: "",
      pickupAddress: "Pickup 1",
      extraPickupAddress: [],
      extraPickupContacts: null,
      legacyWordpressRawMeta: {
        returadresse: "POWER Slependen, Nesbruveien 33, 1396 Hvalstad, Norway",
      },
      deliveryAddress: "Delivery 1",
      returnAddress: "POWER Slependen, Nesbruveien 33, 1396 Hvalstad, Norway",
      drivingDistance: "",
      customerName: "Customer",
      customerLabel: "Customer",
      phone: "",
      phoneTwo: "",
      email: "",
      customerComments: "",
      floorNo: "",
      lift: "",
      cashierName: "",
      cashierPhone: "",
      subcontractorMembershipId: "",
      subcontractor: "",
      driver: "",
      secondDriver: "",
      driverInfo: "",
      licensePlate: "",
      deviation: "",
      feeExtraWork: false,
      feeAddToOrder: false,
      statusNotes: "",
      status: "processing",
      dontSendEmail: false,
      priceExVat: 0,
      priceSubcontractor: 0,
      rabatt: "",
      leggTil: "",
      subcontractorMinus: "",
      subcontractorPlus: "",
      lastEditedByMembershipId: "",
      createdByMembership: null,
      lastEditedByMembership: null,
    });

    const res = await GET(new Request("http://localhost/api/orders/order-1"), {
      params: Promise.resolve({ orderId: "order-1" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      order: {
        priceListId: "price-list-1",
        productCards: [
          expect.objectContaining({
            cardId: 1,
            selectedReturnOptionId: "return-store-id",
          }),
        ],
      },
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
      status: "processing",
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

  it("PATCH returns 400 when an extra pickup email is invalid", async () => {
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
      status: "processing",
      statusNotes: "",
      customerName: "",
      deliveryDate: "",
      timeWindow: "",
      expressDelivery: false,
      contactCustomerForCustomTimeWindow: false,
      customTimeContactNote: null,
      pickupAddress: "",
      extraPickupAddress: [],
      extraPickupContacts: [],
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
          extraPickups: [
            { address: "Store 2", phone: "+47 98 76 54 32", email: "bad" },
          ],
        }),
      }),
      { params: Promise.resolve({ orderId: "order-1" }) },
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_EXTRA_PICKUP_CONTACT",
      message: "Extra pickup 1: Enter a valid email address.",
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

  it("PATCH skips order notification emails when company order emails are disabled", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
      priceListId: "price-list-1",
      company: {
        orderEmailsEnabled: false,
      },
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
    expect(mocks.sendOrderNotificationEmailMock).not.toHaveBeenCalled();
    expect(mocks.sendExtraPickupNotificationEmailMock).not.toHaveBeenCalled();
  });

  it("PATCH creates an order notification when extra pickups change", async () => {
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
      status: "processing",
      statusNotes: "",
      customerName: "",
      deliveryDate: "",
      timeWindow: "",
      expressDelivery: false,
      contactCustomerForCustomTimeWindow: false,
      customTimeContactNote: null,
      pickupAddress: "Store 1",
      extraPickupAddress: [],
      extraPickupContacts: [],
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
      { params: Promise.resolve({ orderId: "order-1" }) },
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
      status: "processing",
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
      status: "processing",
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

    const res = await DELETE(
      new Request("http://localhost/api/orders/order-1"),
      {
        params: Promise.resolve({ orderId: "order-1" }),
      },
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "ORDER_NOT_FOUND",
    });
  });
});
