import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  recomputeMock: vi.fn(),
  resolvePricingMock: vi.fn(),
  getWebsiteOrderCatalogMock: vi.fn(),
  getMovingCatalogMock: vi.fn(),
}));

vi.mock("@/lib/content/websiteOrderCatalog", () => ({ getWebsiteOrderCatalog: mocks.getWebsiteOrderCatalogMock }));
vi.mock("@/lib/content/getMovingCatalog", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content/getMovingCatalog")>("@/lib/content/getMovingCatalog");
  return { ...actual, getMovingCatalog: mocks.getMovingCatalogMock };
});

vi.mock("@/lib/orders/websiteOrderRepricing", () => ({
  recomputeWebsiteOrderPricing: mocks.recomputeMock,
  resolveSavedCatalogPricing: mocks.resolvePricingMock,
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
    mocks.getWebsiteOrderCatalogMock.mockReset();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "ADMIN", appAccess: [] });
    mocks.orderFindFirstMock.mockResolvedValue(whiteGoodsOrder);
    mocks.resolvePricingMock.mockImplementation(async (_order: unknown, cards: { pricingSnapshot?: unknown }[]) =>
      cards.find((c) => c.pricingSnapshot)?.pricingSnapshot ?? null,
    );
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
      { allowIncomplete: true, catalogPricing: null },
    );
    expect(json.order.calculator).toMatchObject({
      products: [{ name: "Vaskemaskin", lines: [{ customer: 899, partner: 400 }] }],
      customer: { total: 899 },
      partner: { total: 400 },
    });
  });

  // Like the booking app: the order is shown at the catalog prices it was
  // saved with; today's total is only offered ("Use new price").
  it("prices the calculator with the order's saved catalog prices and gives today's total separately", async () => {
    const frozen = { productOptions: { frozen: true } };
    mocks.orderFindFirstMock.mockResolvedValue({
      ...whiteGoodsOrder,
      productCardsSnapshot: [{ cardId: 0, productId: "p-wm", pricingSnapshot: frozen }],
    });
    const base = await mocks.recomputeMock();
    mocks.recomputeMock.mockClear();
    mocks.recomputeMock.mockImplementation(async (_order: unknown, _cards: unknown, options: { catalogPricing?: unknown }) =>
      options.catalogPricing
        ? base
        : { pricingResult: { ...base.pricingResult, totals: { ...base.pricingResult.totals, totalExVat: 1099, totalIncVat: 1099 } } },
    );

    const json = await (await call()).json();

    expect(mocks.recomputeMock.mock.calls[0]![2]).toEqual({ allowIncomplete: true, catalogPricing: frozen });
    expect(json.order.calculator.customer.total).toBe(899);
    expect(json.order.currentPricesTotal).toBe(1099);
  });

  it("names each line priced differently today, so 'Use new price' says what changed", async () => {
    const frozen = { productOptions: {}, specialOptions: {}, deliveryTypes: { "p-wm:INDOOR": { price: "690", xtraPrice: "235" } } };
    mocks.orderFindFirstMock.mockResolvedValue({
      ...whiteGoodsOrder,
      productCardsSnapshot: [{ cardId: 0, productId: "p-wm", deliveryType: "INDOOR", pricingSnapshot: frozen }],
    });
    const base = await mocks.recomputeMock();
    const install = (lineTotal: number) => ({
      breakdowns: [
        {
          productName: "Washing machine",
          cardId: 0,
          lines: [{ label: "Install – approved wet room", code: "WM_WET", qty: 2, unitPrice: lineTotal / 2, lineTotal, subcontractorLineTotal: 600 }],
        },
      ],
      totals: { ...base.pricingResult.totals, totalExVat: lineTotal },
    });
    mocks.recomputeMock.mockImplementation(async (_order: unknown, _cards: unknown, options: { catalogPricing?: unknown }) => ({
      ...base,
      pricingResult: install(options.catalogPricing ? 1220 : 1230),
    }));

    const json = await (await call()).json();

    expect(json.order.priceChanges).toEqual([
      { productName: "Washing machine", label: "Install – approved wet room", saved: 1220, now: 1230, savedPartner: 600, nowPartner: 600 },
    ]);
    expect(json.order.savedPricesIncomplete).toEqual([]);

    // A viewer who can't see partner prices gets the customer side only.
    mocks.membershipFindFirstMock.mockResolvedValue({
      role: "USER",
      appAccess: [{ module: "WEBSITE_ORDERS", enabled: true, level: "VIEWER" }],
    });
    const viewer = await (await call()).json();
    expect(viewer.order.priceChanges).toEqual([
      { productName: "Washing machine", label: "Install – approved wet room", saved: 1220, now: 1230, savedPartner: null, nowPartner: null },
    ]);
  });

  it("warns when the order's saved prices are missing a product's delivery or option", async () => {
    const frozen = { productOptions: {}, specialOptions: {}, deliveryTypes: {} };
    mocks.orderFindFirstMock.mockResolvedValue({
      ...whiteGoodsOrder,
      productCardsSnapshot: [{ cardId: 0, productId: "p-wm", deliveryType: "INDOOR", pricingSnapshot: frozen }],
      pricingSnapshot: { lines: [{ cardId: 0, productName: "Washing machine", itemType: "PRODUCT_CARD" }] },
    });

    const json = await (await call()).json();

    expect(json.order.savedPricesIncomplete).toEqual(["Washing machine"]);
  });

  it("loads the catalog once and prices with it every time", async () => {
    const catalog = { products: [], specialOptions: [], priceListSettings: null };
    mocks.getWebsiteOrderCatalogMock.mockResolvedValue(catalog);
    mocks.orderFindFirstMock.mockResolvedValue({ ...whiteGoodsOrder, productCardsSnapshot: [{ cardId: 0, productId: "p-wm" }], items: [] });
    mocks.resolvePricingMock.mockResolvedValue({ productOptions: {} });

    await call();

    expect(mocks.getWebsiteOrderCatalogMock).toHaveBeenCalledTimes(1);
    expect(mocks.resolvePricingMock.mock.calls[0]![3]).toEqual({ catalog });
    expect(mocks.recomputeMock).toHaveBeenCalledTimes(2);
    for (const callArgs of mocks.recomputeMock.mock.calls) expect(callArgs[2]).toMatchObject({ catalog });
  });

  it("shows an older order at the prices read back from its stored lines", async () => {
    const recovered = { productOptions: { recovered: true } };
    mocks.orderFindFirstMock.mockResolvedValue({ ...whiteGoodsOrder, productCardsSnapshot: [{ cardId: 0, productId: "p-wm" }], items: [] });
    mocks.resolvePricingMock.mockResolvedValue(recovered);
    await call();
    expect(mocks.recomputeMock.mock.calls[0]![2]).toEqual({ allowIncomplete: true, catalogPricing: recovered });
  });

  it("gives the calculator's own total as today's for an order saved before it kept its prices", async () => {
    const json = await (await call()).json();
    expect(json.order.currentPricesTotal).toBe(json.order.calculator.customer.total);
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

  it("says whether the customer already has a live My order login for the order's email", async () => {
    const openOrder = { status: "processing", statusChangedAt: null, updatedAt: new Date(), gdprHold: false };

    // No login at all.
    expect((await (await call()).json()).order.hasCustomerLogin).toBe(false);

    mocks.orderFindFirstMock.mockResolvedValue({ ...whiteGoodsOrder, customerAccount: { email: "kari@example.no", orders: [openOrder] } });
    expect((await (await call()).json()).order.hasCustomerLogin).toBe(true);

    // Staff corrected the order's email: the login is for the old one, so a new login is still needed.
    mocks.orderFindFirstMock.mockResolvedValue({ ...whiteGoodsOrder, customerAccount: { email: "old@example.no", orders: [openOrder] } });
    expect((await (await call()).json()).order.hasCustomerLogin).toBe(false);

    // Past its delete time (all orders closed days ago), just not cleaned up yet.
    const closedLongAgo = { status: "completed", statusChangedAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"), gdprHold: false };
    mocks.orderFindFirstMock.mockResolvedValue({ ...whiteGoodsOrder, customerAccount: { email: "kari@example.no", orders: [closedLongAgo] } });
    expect((await (await call()).json()).order.hasCustomerLogin).toBe(false);
  });

  it("says how the order compares with what the customer has paid", async () => {
    // Stored ex. VAT (2855); no saved incl.-VAT total here, so the customer pays 25% on top.
    let json = await (await call()).json();
    expect(json.order.payment).toMatchObject({ outcome: "unpaid", totalPaidIncVatNok: 0, currentTotalIncVatNok: 3568.75 });

    mocks.orderFindFirstMock.mockResolvedValue({
      ...whiteGoodsOrder,
      payments: [{ amountChargedCents: 200000, createdAt: new Date("2026-10-03T10:00:00Z"), orderSnapshot: null }],
    });
    json = await (await call()).json();
    expect(json.order.payment).toMatchObject({ outcome: "due", totalPaidIncVatNok: 2000, differenceIncVatNok: 1568.75 });
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
    mocks.getWebsiteOrderCatalogMock.mockReset();
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

describe("GET /api/orders/[orderId]/website-details — a homepage move", () => {
  const apartment = { homeType: "APARTMENT", sizeOptionCode: "SIZE_UNDER_40", floors: 1, floorNumber: 1, hasLift: null, parking: "OUTSIDE" };
  const house = { homeType: "DETACHED", sizeOptionCode: "SIZE_UNDER_40", floors: 2, floorNumber: null, hasLift: null, parking: "OUTSIDE" };
  const item = (productCode: string, optionLabel: string, quantity: number, customerPriceCents: number, subcontractorPriceCents: number) => ({
    productCode,
    optionCode: optionLabel,
    optionLabel,
    quantity,
    customerPriceCents,
    subcontractorPriceCents,
    optionId: null,
  });
  const move = {
    ...whiteGoodsOrder,
    websiteOrderKind: "MOVING",
    websiteBookingDetails: { version: 1, customerType: "business", origin: apartment, destination: house, serviceCodes: ["SERVICE_FLYTTEVASK"] },
    pickupAddress: "Karl Johans gate 1, Oslo",
    deliveryAddress: "Bragernes torg 1, Drammen",
    deliveryDate: "2026-10-22",
    timeWindow: "10:00-16:00",
    drivingDistance: "42.86",
    priceExVat: 9800 + 1243,
    pricingSnapshot: { customer: { totalExVat: 11043, totalIncVat: 13804 }, lines: [] },
    items: [
      item("MOVING_BY_SIZE", "Under 40 m²", 1, 500000, 300000),
      item("MOVING_ADDITIONAL_SERVICES", "Move-out cleaning", 1, 480000, 250000),
      item("MOVING_DISTANCE", "Distance (43 km)", 43, 2890, 1651),
    ],
    payments: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "ADMIN", appAccess: [] });
    mocks.orderFindFirstMock.mockResolvedValue(move);
  });

  it("opens in the website order modal as a move: its answers, its lines, the partner's side", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const { order } = await res.json();
    expect(order.kind).toBe("moving");
    expect(order.moving).toEqual({
      edit: {
        pickupAddress: "Karl Johans gate 1, Oslo",
        deliveryAddress: "Bragernes torg 1, Drammen",
        origin: apartment,
        destination: house,
        serviceCodes: ["SERVICE_FLYTTEVASK"],
      },
      customerType: "business",
      preferredDate: "2026-10-22",
      timeWindow: "10:00-16:00",
      drivingDistance: "42.86",
    });
    expect(order.products[0].items.map((i: { label: string }) => i.label)).toEqual(["Under 40 m²", "Move-out cleaning"]);
    expect(order.orderExtras).toEqual([{ label: "Distance (43 km)", qty: 43, price: 1243 }]);
    // The same calculator a delivery order has: every line with its code, both sides.
    expect(order.calculator.products.map((p: { name: string }) => p.name)).toEqual(["Moving", "Order extras"]);
    expect(order.calculator.products[0].lines[0]).toMatchObject({ code: "Under 40 m²", customer: 5000, partner: 3000 });
    expect(order.calculator.customer).toMatchObject({ subtotal: 11043, discount: 0, extra: 0, total: 11043 });
    expect(order.calculator.partner.total).toBe(3000 + 2500 + 710);
    // The lines add up to the stored total — no price warning.
    expect(order.totalsCheck.missingFromLines).toBe(0);
    expect(mocks.recomputeMock).not.toHaveBeenCalled();
  });

  it("hides the partner's side from someone who can only view website orders", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "USER", appAccess: [{ module: "WEBSITE_ORDERS", enabled: true, level: "VIEWER" }] });
    expect((await (await call()).json()).order.calculator.partner).toBeNull();
  });

  it("shows the move's stored discount, extra and partner minus/plus in its calculator", async () => {
    mocks.orderFindFirstMock.mockResolvedValue({ ...move, rabatt: "1043", leggTil: "200", subcontractorMinus: "500", subcontractorPlus: "100", priceExVat: 10200 });
    const { order } = await (await call()).json();
    expect(order.calculator.customer).toMatchObject({ discount: 1043, extra: 200, total: 10200 });
    expect(order.calculator.partner).toMatchObject({ minus: 500, plus: 100, total: 6210 - 500 + 100 });
    expect(order.totalsCheck.missingFromLines).toBe(0);
  });

  it("shows the move's lines set to 0 at 0 kr, still explaining the stored total", async () => {
    mocks.orderFindFirstMock.mockResolvedValue({
      ...move,
      priceExVat: 11043 - 4800,
      pricingSnapshot: { ...move.pricingSnapshot, movingNulledLines: { customer: ["MOVING_ADDITIONAL_SERVICES:Move-out cleaning"], subcontractor: [] } },
    });
    const { order } = await (await call()).json();
    expect(order.calculator.products[0].lines[1]).toMatchObject({ customer: 0, nulledCustomer: true, lineKey: "MOVING_ADDITIONAL_SERVICES:Move-out cleaning" });
    expect(order.calculator.customer.total).toBe(6243);
    expect(order.totalsCheck.missingFromLines).toBe(0);
  });

  describe("\"Use new price\" on a move", () => {
    const sizeOnly = {
      ...move,
      websiteBookingDetails: { ...move.websiteBookingDetails, serviceCodes: [] },
      drivingDistance: "",
      priceExVat: 5000,
      items: [{ ...move.items[0], optionCode: "SIZE_UNDER_40" }],
    };
    const catalogAt = (customerPriceCents: number) => ({
      priceListId: "pl",
      options: [{ code: "SIZE_UNDER_40", labelEn: "Under 40 m²", labelNo: "Under 40 m²", customerPriceCents, subcontractorPriceCents: 300000 }],
      services: [],
      floorSurcharge: null,
      carrySurcharges: [],
      distanceRates: null,
    });

    it("names the lines priced differently today and gives today's total", async () => {
      mocks.orderFindFirstMock.mockResolvedValue(sizeOnly);
      mocks.getMovingCatalogMock.mockResolvedValue(catalogAt(550000));
      const { order } = await (await call()).json();
      expect(order.priceChanges).toEqual([{ productName: "Moving", label: "Under 40 m²", saved: 5000, now: 5500, savedPartner: 3000, nowPartner: 3000 }]);
      expect(order.currentPricesTotal).toBe(5500);
    });

    it("has nothing to offer when the prices haven't moved", async () => {
      mocks.orderFindFirstMock.mockResolvedValue(sizeOnly);
      mocks.getMovingCatalogMock.mockResolvedValue(catalogAt(500000));
      const { order } = await (await call()).json();
      expect(order.priceChanges).toEqual([]);
      expect(order.currentPricesTotal).toBe(5000);
    });
  });

  it("a move booked before its answers were stored still isn't a website-modal order", async () => {
    mocks.orderFindFirstMock.mockResolvedValue({ ...move, websiteBookingDetails: null });
    expect((await (await call()).json()).reason).toBe("NOT_WHITE_GOODS_WEBSITE_ORDER");
  });
});

describe("GET /api/orders/[orderId]/website-details — a homepage service request", () => {
  const quoteItem = {
    productCode: "SERVICE_QUOTE",
    optionCode: "QUOTE:option-1",
    optionLabel: "Electrician",
    quantity: 1,
    customerPriceCents: 400000,
    subcontractorPriceCents: 250000,
    optionId: null,
  };
  const serviceOrder = {
    ...whiteGoodsOrder,
    websiteOrderKind: "SERVICE",
    websiteBookingDetails: {
      version: 2,
      customerType: "business",
      services: [
        { serviceCode: "option-1", customService: "", jobDescription: "Install lights." },
        { serviceCode: "option-2", customService: "", jobDescription: "Fix the door." },
      ],
    },
    pickupAddress: null,
    deliveryAddress: "Storgata 1, Oslo",
    deliveryDate: "2026-10-22",
    timeWindow: "08:00-16:00",
    priceExVat: 4000,
    pricingSnapshot: { customer: { totalExVat: 4000, totalIncVat: 5000 }, lines: [] },
    items: [quoteItem],
    payments: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "ADMIN", appAccess: [] });
    mocks.orderFindFirstMock.mockResolvedValue(serviceOrder);
  });

  it("opens in the website order modal as a service: its answers, the quote and the calculator", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const { order } = await res.json();
    expect(order.kind).toBe("service");
    expect(order.service).toEqual({
      edit: {
        address: "Storgata 1, Oslo",
        services: [
          { serviceCode: "option-1", customService: "", jobDescription: "Install lights.", quote: { customer: 4000, partner: 2500 } },
          // Not quoted yet.
          { serviceCode: "option-2", customService: "", jobDescription: "Fix the door.", quote: { customer: null, partner: null } },
        ],
      },
      customerType: "business",
      preferredDate: "2026-10-22",
      timeWindow: "08:00-16:00",
    });
    expect(order.calculator.products.map((p: { name: string }) => p.name)).toEqual(["Service"]);
    expect(order.calculator.customer.total).toBe(4000);
    expect(order.calculator.partner.total).toBe(2500);
    expect(order.totalsCheck.missingFromLines).toBe(0);
    expect(mocks.recomputeMock).not.toHaveBeenCalled();
  });

  it("opens an unquoted request with an empty calculator", async () => {
    mocks.orderFindFirstMock.mockResolvedValue({ ...serviceOrder, items: [], priceExVat: 0 });
    const { order } = await (await call()).json();
    expect(order.service.edit.services[0].quote).toEqual({ customer: null, partner: null });
    expect(order.calculator.products).toEqual([]);
    expect(order.totalsCheck.missingFromLines).toBe(0);
  });

  it("hides the partner's side from someone who can only view website orders", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "USER", appAccess: [{ module: "WEBSITE_ORDERS", enabled: true, level: "VIEWER" }] });
    const { order } = await (await call()).json();
    expect(order.calculator.partner).toBeNull();
    expect(order.service.edit.services[0].quote).toEqual({ customer: 4000, partner: null });
  });
});
