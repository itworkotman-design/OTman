import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  recomputeMock: vi.fn(),
}));

vi.mock("@/lib/orders/websiteOrderRepricing", () => ({
  recomputeWebsiteOrderPricing: mocks.recomputeMock,
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
    mocks.recomputeMock.mockResolvedValue({
      pricingResult: {
        breakdowns: [
          { productName: "Vaskemaskin", cardId: 0, lines: [{ label: "Levering", qty: 1, unitPrice: 899, lineTotal: 899, subcontractorLineTotal: 400 }] },
        ],
        totals: {
          subtotalExVat: 899,
          discount: 0,
          extra: 0,
          checkboxDiscount: 0,
          totalExVat: 899,
          vat: 0,
          totalIncVat: 899,
          subcontractorBase: 400,
          subcontractorMinus: 0,
          subcontractorPlus: 0,
          subcontractorCheckboxDiscount: 0,
          subcontractorTotal: 400,
        },
      },
    });
  });

  it("returns the calculator — customer and partner side — priced from the stored products", async () => {
    mocks.orderFindFirstMock.mockResolvedValue({ ...whiteGoodsOrder, productCardsSnapshot: [{ cardId: 0, productId: "p-wm" }] });
    const json = await (await call()).json();
    expect(mocks.recomputeMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "order-1" }),
      [{ cardId: 0, productId: "p-wm" }],
      { allowIncomplete: true },
    );
    expect(json.order.calculator).toMatchObject({
      products: [{ name: "Vaskemaskin", lines: [{ customer: 899, partner: 400 }] }],
      customer: { total: 899 },
      partner: { total: 400 },
    });
  });

  it("hides partner prices from someone who can only view website orders", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({
      role: "USER",
      appAccess: [{ module: "WEBSITE_ORDERS", enabled: true, level: "VIEWER" }],
    });
    const json = await (await call()).json();
    expect(json.order.calculator.partner).toBeNull();
    expect(json.order.calculator.products[0].lines[0].partner).toBeNull();
  });

  it("still opens the order when it can't be priced (no calculator)", async () => {
    mocks.recomputeMock.mockRejectedValue(new Error("catalog down"));
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).order.calculator).toBeNull();
  });

  it("returns the admin's handling fields for the panel", async () => {
    mocks.orderFindFirstMock.mockResolvedValue({
      ...whiteGoodsOrder,
      driver: "Per",
      secondDriver: null,
      driverInfo: "Ring først",
      licensePlate: "EL 12345",
      deviation: null,
      dontSendEmail: true,
      description: "Intern",
      expressDelivery: false,
      rabatt: "100",
      leggTil: null,
    });
    const json = await (await call()).json();
    expect(json.order.handling).toMatchObject({
      driver: "Per",
      secondDriver: "",
      driverInfo: "Ring først",
      licensePlate: "EL 12345",
      deviation: "",
      description: "Intern",
      expressDelivery: false,
      rabatt: "100",
      leggTil: "",
    });
    expect(json.order.handling).not.toHaveProperty("dontSendEmail");
  });

  it("says how the order compares with what the customer has paid", async () => {
    let json = await (await call()).json();
    expect(json.order.payment).toMatchObject({ outcome: "unpaid", totalPaidIncVatNok: 0, currentTotalIncVatNok: 2855 });

    mocks.orderFindFirstMock.mockResolvedValue({
      ...whiteGoodsOrder,
      payments: [{ amountChargedCents: 200000, createdAt: new Date("2026-10-03T10:00:00Z"), orderSnapshot: null }],
    });
    json = await (await call()).json();
    expect(json.order.payment).toMatchObject({ outcome: "due", totalPaidIncVatNok: 2000, differenceIncVatNok: 855 });
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
    expect(json.order.totalsCheck).toEqual({
      linesTotal: 970.21,
      missingFromLines: 200.79,
      shownTotal: null,
      differsFromShown: 0,
    });
    expect(json.order).toMatchObject({
      subcontractorMembershipId: "sub-1",
      subcontractor: "Flyttefirma AS",
      gsmSentAt: "2026-10-02T09:00:00.000Z",
      gsmSyncStatus: "SENT",
    });
  });
});
