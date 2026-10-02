import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirstMock },
    order: { findFirst: mocks.orderFindFirstMock },
  },
}));

import { GET } from "./route";

const details = {
  version: 1,
  customerType: "private",
  pickups: [
    {
      source: "store",
      placeName: "Power",
      address: "Strømmen 1",
      floor: null,
      liftAvailable: false,
      contactName: "",
      contactPhone: "",
    },
  ],
  delivery: { address: "Kirkegata 5", floor: 3, liftAvailable: false },
  preferredDate: "2026-10-05",
  timeWindow: "08:00-16:00",
  drivingDistance: "21",
  orderExtras: [{ label: "Etasjetillegg", price: 71.21, qty: 1 }],
};

const whiteGoodsOrder = {
  id: "order-1",
  displayId: 42,
  orderNumber: "583920",
  status: "processing",
  createdAt: new Date("2026-10-01T10:00:00Z"),
  customerName: "Kari",
  phone: "87654321",
  email: "kari@example.no",
  customerComments: "Ring på",
  statusNotes: null,
  priceExVat: 2855,
  websiteOrderKind: "WHITE_GOODS",
  websiteBookingDetails: details,
  pricingSnapshot: {
    version: 1,
    lines: [
      {
        cardId: 0,
        productCode: "WM",
        productName: "Vaskemaskin",
        deliveryType: "INSIDE",
        itemType: "BASE_OPTION",
        optionCode: "INN",
        optionLabel: "Levering med innbæring",
        quantity: 1,
        customerUnitPrice: 899,
        customerLineTotal: 899,
        subcontractorUnitPrice: null,
        subcontractorLineTotal: null,
      },
    ],
  },
};

function request() {
  return new Request("http://localhost/api/orders/order-1/website-details", { headers: { cookie: "session=x" } });
}

async function call() {
  return GET(request(), { params: Promise.resolve({ orderId: "order-1" }) });
}

describe("GET /api/orders/[orderId]/website-details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "ADMIN", appAccess: [] });
    mocks.orderFindFirstMock.mockResolvedValue(whiteGoodsOrder);
  });

  it("returns 401 without a session", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
  });

  it("returns 403 for a plain user without the Website Orders module", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({
      role: "USER",
      appAccess: [{ module: "BOOKING", enabled: true, level: "ADMIN" }],
    });
    const res = await call();
    expect(res.status).toBe(403);
    expect(mocks.orderFindFirstMock).not.toHaveBeenCalled();
  });

  it("lets a plain user with the Website Orders module in", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({
      role: "USER",
      appAccess: [{ module: "WEBSITE_ORDERS", enabled: true, level: "VIEWER" }],
    });
    const res = await call();
    expect(res.status).toBe(200);
  });

  it("scopes the order lookup to the active company", async () => {
    await call();
    expect(mocks.orderFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "order-1", companyId: "c1" } }),
    );
  });

  it("returns 404 NOT_WHITE_GOODS_WEBSITE_ORDER for any other order", async () => {
    for (const order of [
      { ...whiteGoodsOrder, websiteOrderKind: null },
      { ...whiteGoodsOrder, websiteBookingDetails: { version: 2 } },
    ]) {
      mocks.orderFindFirstMock.mockResolvedValue(order);
      const res = await call();
      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toEqual({ ok: false, reason: "NOT_WHITE_GOODS_WEBSITE_ORDER" });
    }
  });

  it("returns 404 NOT_FOUND when the order doesn't exist in this company", async () => {
    mocks.orderFindFirstMock.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("returns the booking details and products grouped per card", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.order).toMatchObject({
      id: "order-1",
      displayId: 42,
      orderNumber: "583920",
      customerName: "Kari",
      customerComments: "Ring på",
      priceExVat: 2855,
      details: { customerType: "private", orderExtras: [{ label: "Etasjetillegg", price: 71.21, qty: 1 }] },
      products: [
        {
          cardId: 0,
          productName: "Vaskemaskin",
          total: 899,
          items: [{ label: "Levering med innbæring", qty: 1, price: 899 }],
        },
      ],
    });
  });
});

describe("GET website-details — live order data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "ADMIN", appAccess: [] });
  });

  it("overlays the order's current addresses/date and reports what the lines don't explain", async () => {
    mocks.orderFindFirstMock.mockResolvedValue({
      ...whiteGoodsOrder,
      pickupAddress: "Ny gate 1",
      deliveryAddress: "Ny gate 2",
      extraPickupAddress: [],
      deliveryDate: "2026-10-09",
      timeWindow: "10:00-16:00",
      drivingDistance: "30",
      // 899 product + 71.21 extras booked; total since re-priced to 1171.
      priceExVat: 1171,
      subcontractorMembershipId: "sub-1",
      subcontractor: "Flyttefirma AS",
      gsmSentAt: new Date("2026-10-02T09:00:00Z"),
      gsmSyncStatus: "SENT",
    });

    const json = await (await call()).json();

    expect(json.order.details.pickups[0].address).toBe("Ny gate 1");
    expect(json.order.details.delivery.address).toBe("Ny gate 2");
    expect(json.order.details.preferredDate).toBe("2026-10-09");
    expect(json.order.priceDifference).toBe(201);
    expect(json.order).toMatchObject({
      subcontractorMembershipId: "sub-1",
      subcontractor: "Flyttefirma AS",
      gsmSentAt: "2026-10-02T09:00:00.000Z",
      gsmSyncStatus: "SENT",
    });
  });
});
