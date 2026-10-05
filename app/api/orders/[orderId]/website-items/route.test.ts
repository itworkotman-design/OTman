import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  transactionMock: vi.fn(),
  getWebsiteOrderCatalogMock: vi.fn(),
  listSeededWebsiteCatalogsMock: vi.fn(),
  recomputeMock: vi.fn(),
  pricingWritesMock: vi.fn(),
  sendLifecycleEmailsMock: vi.fn(),
  createOrderUpdatedEventMock: vi.fn(),
  resolveAllOrderNotificationsMock: vi.fn(),
  getRouteDistanceMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirstMock },
    order: { findFirst: mocks.orderFindFirstMock },
    $transaction: mocks.transactionMock,
  },
}));

vi.mock("@/lib/content/websiteOrderCatalog", () => ({
  getWebsiteOrderCatalog: mocks.getWebsiteOrderCatalogMock,
  listSeededWebsiteCatalogs: mocks.listSeededWebsiteCatalogsMock,
}));

// The pricing pipeline itself is covered by the edit-items route tests; here
// only this route's own decisions (access, validation, details, payment link)
// matter.
vi.mock("@/lib/orders/websiteOrderRepricing", async () => {
  const actual = await vi.importActual<typeof import("@/lib/orders/websiteOrderRepricing")>(
    "@/lib/orders/websiteOrderRepricing",
  );
  return {
    ...actual,
    recomputeWebsiteOrderPricing: mocks.recomputeMock,
    websiteOrderPricingWrites: mocks.pricingWritesMock,
  };
});

vi.mock("@/lib/orders/sendCustomerLifecycleEmail", () => ({
  sendLifecycleEmailsForOrders: mocks.sendLifecycleEmailsMock,
}));

vi.mock("@/lib/orders/orderEvents", () => ({
  createOrderUpdatedEvent: mocks.createOrderUpdatedEventMock,
}));

vi.mock("@/lib/orders/orderNotifications", () => ({
  resolveAllOrderNotifications: mocks.resolveAllOrderNotificationsMock,
}));

vi.mock("@/lib/integrations/mapbox/routeDistance", () => ({
  getRouteDistance: mocks.getRouteDistanceMock,
}));

import { createEmptyProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { buildOrderStateSnapshot } from "@/lib/orders/paidOrderSnapshot";
import { GET, PUT } from "./route";

const washer = { id: "p-wm", code: "WG_WASHING_MACHINE", productName: "Vaskemaskin", options: [] };
const sofa = { id: "p-sofa", code: "FN_SOFA", productName: "Sofa", options: [] };

const card = (cardId: number, productId: string) => ({ ...createEmptyProductCard(cardId), productId, amount: 1 });

const storePickup = {
  source: "store",
  placeName: "Power",
  address: "Strømmen 1",
  floor: null,
  liftAvailable: false,
  contactName: "",
  contactPhone: "",
};

const bookingDetails = {
  version: 1,
  customerType: "business",
  pickups: [storePickup],
  delivery: { address: "Kirkegata 5", floor: null, liftAvailable: false },
  preferredDate: "2026-10-10",
  timeWindow: "08:00-16:00",
  drivingDistance: "21",
  orderExtras: [],
};

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    companyId: "c1",
    displayId: 42,
    orderNumber: "583920",
    status: "processing",
    customerName: "Kari",
    customerLabel: null,
    statusNotes: null,
    phone: "87654321",
    email: "kari@example.no",
    customerComments: null,
    description: null,
    driver: null,
    secondDriver: null,
    driverInfo: null,
    licensePlate: null,
    deviation: null,
    dontSendEmail: false,
    actionToken: null,
    emailThreadToken: null,
    paymentRequestSentAt: null,
    priceExVat: 1000,
    productsSummary: "Vaskemaskin",
    rabatt: null,
    leggTil: null,
    subcontractorMinus: null,
    subcontractorPlus: null,
    pricingSnapshot: { customer: { totalExVat: 1000 }, lines: [] },
    pickupAddress: "Strømmen 1",
    deliveryAddress: "Kirkegata 5",
    deliveryDate: "2026-10-10",
    timeWindow: "08:00-16:00",
    drivingDistance: "21",
    expressDelivery: false,
    floorNo: "0",
    lift: "yes",
    extraPickupAddress: [],
    websiteOrderKind: "WHITE_GOODS",
    websiteBookingDetails: bookingDetails,
    productCardsSnapshot: [card(0, "p-wm")],
    payments: [],
    ...overrides,
  };
}

function recomputed(priceExVat: number) {
  return {
    cards: [card(0, "p-wm"), card(1, "p-sofa")],
    builtItems: [],
    summaries: { productsSummary: "Vaskemaskin, Sofa" },
    pricingSnapshot: { customer: { totalExVat: priceExVat, totalIncVat: priceExVat * 1.25 }, lines: [] },
    priceExVat,
    priceSubcontractor: 0,
    orderExtras: [],
    pricingResult: {
      breakdowns: [
        { productName: "Vaskemaskin", cardId: 0, lines: [{ label: "Levering", qty: 1, unitPrice: priceExVat, lineTotal: priceExVat, subcontractorLineTotal: 400 }] },
      ],
      totals: {
        subtotalExVat: priceExVat,
        discount: 0,
        extra: 0,
        checkboxDiscount: 0,
        totalExVat: priceExVat,
        vat: 0,
        totalIncVat: priceExVat,
        subcontractorBase: 400,
        subcontractorMinus: 0,
        subcontractorPlus: 0,
        subcontractorCheckboxDiscount: 0,
        subcontractorTotal: 400,
      },
    },
  };
}

// A paid order: what was paid for is the order as it stands in order().
function paidOrder(paidCents: number, overrides: Record<string, unknown> = {}) {
  const base = order({ status: "confirmed", actionToken: "tok", ...overrides });
  return {
    ...base,
    payments: [
      { amountChargedCents: paidCents, createdAt: new Date("2026-10-03T10:00:00Z"), orderSnapshot: buildOrderStateSnapshot(base) },
    ],
  };
}

const editedDetails = {
  customer: { name: "Kari", phone: "87654321", email: "kari@example.no", comments: "", customerType: "business" },
  pickups: [{ ...storePickup, productNames: [] }],
  delivery: { address: "Kirkegata 5", floor: null, liftAvailable: false },
  preferredDate: "2026-10-10",
  timeWindow: "08:00-16:00",
  drivingDistanceOverride: null,
};

function putRequest(body: unknown) {
  return new Request("http://localhost/api/orders/order-1/website-items", {
    method: "PUT",
    headers: { cookie: "session=x", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function put(body: unknown) {
  return PUT(putRequest(body), { params: Promise.resolve({ orderId: "order-1" }) });
}

async function get() {
  const req = new Request("http://localhost/api/orders/order-1/website-items", { headers: { cookie: "session=x" } });
  return GET(req, { params: Promise.resolve({ orderId: "order-1" }) });
}

const twoCards = { productCards: [card(0, "p-wm"), card(1, "p-sofa")] };

describe("/api/orders/[orderId]/website-items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "m1",
      role: "ADMIN",
      appAccess: [],
      user: { username: "admin", email: "admin@otman.no" },
    });
    mocks.orderFindFirstMock.mockResolvedValue(order());
    mocks.getWebsiteOrderCatalogMock.mockResolvedValue({ products: [washer, sofa], specialOptions: [] });
    mocks.listSeededWebsiteCatalogsMock.mockResolvedValue([
      { catalog: { priceListCode: "WG", labelEn: "White goods", labelNo: "Hvitevarer", products: [{ code: washer.code }] } },
      { catalog: { priceListCode: "FN", labelEn: "Furniture", labelNo: "Møbler", products: [{ code: sofa.code }] } },
    ]);
    mocks.recomputeMock.mockResolvedValue(recomputed(1500));
    mocks.pricingWritesMock.mockReturnValue(["writes"]);
    mocks.transactionMock.mockResolvedValue([]);
    mocks.sendLifecycleEmailsMock.mockResolvedValue({ sentCount: 1, failedOrderIds: [] });
    mocks.getRouteDistanceMock.mockResolvedValue({ distanceKm: "33.10", stopAddresses: [] });
  });

  describe("access", () => {
    it("401 without a session", async () => {
      mocks.getAuthenticatedSessionMock.mockResolvedValue(null);
      expect((await put(twoCards)).status).toBe(401);
      expect((await get()).status).toBe(401);
    });

    it("403 for a plain user without website-orders admin access", async () => {
      mocks.membershipFindFirstMock.mockResolvedValue({ id: "m1", role: "USER", appAccess: [], user: {} });
      expect((await put(twoCards)).status).toBe(403);
      expect((await get()).status).toBe(403);
    });

    it("403 for a website-orders VIEWER", async () => {
      mocks.membershipFindFirstMock.mockResolvedValue({
        id: "m1",
        role: "USER",
        appAccess: [{ module: "WEBSITE_ORDERS", enabled: true, level: "VIEWER" }],
        user: {},
      });
      expect((await put(twoCards)).status).toBe(403);
    });

    it("allows a website-orders ADMIN who isn't a company admin", async () => {
      mocks.membershipFindFirstMock.mockResolvedValue({
        id: "m1",
        role: "USER",
        appAccess: [{ module: "WEBSITE_ORDERS", enabled: true, level: "ADMIN" }],
        user: {},
      });
      expect((await put(twoCards)).status).toBe(200);
    });

    it("404 for an order that isn't a homepage white-goods order", async () => {
      mocks.orderFindFirstMock.mockResolvedValue(order({ websiteOrderKind: null }));
      expect((await put(twoCards)).status).toBe(404);
      expect((await get()).status).toBe(404);
    });
  });

  describe("GET", () => {
    it("returns the order's cards, editable details, payment comparison and every website product by category", async () => {
      const res = await get();
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.productCards).toHaveLength(1);
      expect(json.productCards[0].productId).toBe("p-wm");
      expect(json.customerType).toBe("business");
      expect(json.details).toMatchObject({
        customer: { name: "Kari", phone: "87654321" },
        pickups: [{ address: "Strømmen 1", source: "store" }],
        delivery: { address: "Kirkegata 5" },
      });
      expect(json.drivingDistance).toBe("21");
      // So the editor's own live price includes express/discount/extra/deviation.
      expect(json.handling).toMatchObject({ expressDelivery: false, rabatt: "", leggTil: "", deviation: "" });
      expect(json.comparison).toMatchObject({ outcome: "unpaid", currentTotalIncVatNok: 1000 });
      expect(json.catalogProducts.map((p: { id: string }) => p.id)).toEqual(["p-wm", "p-sofa"]);
      expect(json.categories).toEqual([
        { code: "WG", labelEn: "White goods", labelNo: "Hvitevarer", productIds: ["p-wm"] },
        { code: "FN", labelEn: "Furniture", labelNo: "Møbler", productIds: ["p-sofa"] },
      ]);
    });
  });

  describe("PUT (save products)", () => {
    it("re-prices and saves the new cards without emailing anyone", async () => {
      const res = await put(twoCards);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toMatchObject({ ok: true, previousPriceExVat: 1000, priceExVat: 1500, emailSent: null });
      expect(mocks.recomputeMock).toHaveBeenCalledWith(expect.objectContaining({ id: "order-1" }), twoCards.productCards, {
        allowIncomplete: true,
      });
      const [, , data] = mocks.pricingWritesMock.mock.calls[0]!;
      expect(data).toEqual({ lastEditedByMembershipId: "m1" });
      expect(mocks.transactionMock).toHaveBeenCalledWith(["writes"]);
      expect(mocks.sendLifecycleEmailsMock).not.toHaveBeenCalled();
      expect(mocks.createOrderUpdatedEventMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          orderId: "order-1",
          changes: expect.arrayContaining([
            expect.objectContaining({ field: "priceExVat", previousValue: "1000", nextValue: "1500" }),
          ]),
        }),
      );
    });

    it("allows lowering the price (the admin decides)", async () => {
      mocks.recomputeMock.mockResolvedValue(recomputed(600));
      const res = await put(twoCards);
      expect(res.status).toBe(200);
      expect((await res.json()).priceExVat).toBe(600);
    });

    it("saves an order with no products (an admin can save anything)", async () => {
      expect((await put({ productCards: [] })).status).toBe(200);
      expect(mocks.recomputeMock.mock.calls[0]![1]).toEqual([]);
    });

    it("doesn't block an admin save on an installation-only item without its installation", async () => {
      const installOnly = { ...card(0, "p-wm"), deliveryType: "INSTALL_ONLY" };
      expect((await put({ productCards: [installOnly] })).status).toBe(200);
    });

    it("rejects a product that isn't sold on the website", async () => {
      const res = await put({ productCards: [card(0, "p-dashboard-only")] });
      expect(res.status).toBe(422);
      expect((await res.json()).reason).toBe("UNKNOWN_PRODUCT");
      expect(mocks.transactionMock).not.toHaveBeenCalled();
    });

    it("refuses to edit an order that's cancelled or done", async () => {
      for (const status of ["cancelled", "completed", "invoiced", "paid"]) {
        mocks.orderFindFirstMock.mockResolvedValueOnce(order({ status }));
        const res = await put(twoCards);
        expect(res.status).toBe(409);
        expect((await res.json()).reason).toBe("NOT_EDITABLE_STATUS");
      }
      expect(mocks.transactionMock).not.toHaveBeenCalled();
    });
  });

  describe("PUT (save details)", () => {
    it("keeps the stored products when only details are sent", async () => {
      const res = await put({ details: editedDetails });
      expect(res.status).toBe(200);
      expect(mocks.recomputeMock.mock.calls[0]![1]).toEqual([card(0, "p-wm")]);
    });

    it("writes the edited columns and re-prices with the new stops, recalculating the route when an address changed", async () => {
      const res = await put({
        details: {
          ...editedDetails,
          customer: { ...editedDetails.customer, name: "Kari Nordmann" },
          pickups: [
            { ...storePickup, productNames: [] },
            { ...storePickup, source: "private", address: "Bjerke 9", floor: 3, productNames: [] },
          ],
          delivery: { address: "Storgata 1", floor: 2, liftAvailable: true },
        },
      });
      expect(res.status).toBe(200);
      expect((await res.json()).drivingDistance).toBe("33.10");

      expect(mocks.getRouteDistanceMock).toHaveBeenCalledWith({
        pickupAddress: "Strømmen 1",
        extraPickupAddresses: ["Bjerke 9"],
        deliveryAddress: "Storgata 1",
      });
      const pricedOrder = mocks.recomputeMock.mock.calls[0]![0];
      expect(pricedOrder).toMatchObject({ drivingDistance: "33.10", extraPickupAddress: ["Bjerke 9"] });
      expect(pricedOrder.websiteBookingDetails.pickups).toHaveLength(2);

      const [target, , data] = mocks.pricingWritesMock.mock.calls[0]!;
      expect(target.websiteBookingDetails.delivery).toEqual({ address: "Storgata 1", floor: 2, liftAvailable: true });
      expect(data).toMatchObject({
        lastEditedByMembershipId: "m1",
        customerName: "Kari Nordmann",
        deliveryAddress: "Storgata 1",
        extraPickupAddress: ["Bjerke 9"],
        drivingDistance: "33.10",
      });
      expect(mocks.createOrderUpdatedEventMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          changes: expect.arrayContaining([
            expect.objectContaining({ field: "deliveryAddress", previousValue: "Kirkegata 5", nextValue: "Storgata 1" }),
            expect.objectContaining({ field: "customerName", nextValue: "Kari Nordmann" }),
          ]),
        }),
      );
    });

    it("keeps the stored distance when no address changed", async () => {
      await put({ details: { ...editedDetails, preferredDate: "2026-10-12" } });
      expect(mocks.getRouteDistanceMock).not.toHaveBeenCalled();
      expect(mocks.recomputeMock.mock.calls[0]![0].drivingDistance).toBe("21");
    });

    it("uses the admin's distance override instead of the route", async () => {
      await put({
        details: { ...editedDetails, delivery: { ...editedDetails.delivery, address: "Storgata 1" }, drivingDistanceOverride: "40" },
      });
      expect(mocks.getRouteDistanceMock).not.toHaveBeenCalled();
      expect(mocks.recomputeMock.mock.calls[0]![0].drivingDistance).toBe("40");
    });

    it("still saves, keeping the stored distance, when the route can't be calculated", async () => {
      mocks.getRouteDistanceMock.mockRejectedValue(new Error("MAPBOX_GEOCODING_NO_MATCH"));
      const res = await put({ details: { ...editedDetails, delivery: { ...editedDetails.delivery, address: "Nowhere" } } });
      expect(res.status).toBe(200);
      expect(mocks.recomputeMock.mock.calls[0]![0].drivingDistance).toBe("21");
    });

    it("doesn't route an order with an empty address", async () => {
      const res = await put({ details: { ...editedDetails, delivery: { ...editedDetails.delivery, address: "" } } });
      expect(res.status).toBe(200);
      expect(mocks.getRouteDistanceMock).not.toHaveBeenCalled();
    });

    it("returns the field errors for details in the wrong format", async () => {
      const res = await put({ details: { ...editedDetails, customer: { ...editedDetails.customer, phone: "abc" } } });
      expect(res.status).toBe(422);
      expect(await res.json()).toMatchObject({ reason: "INVALID_DETAILS", errors: { "customer.phone": expect.any(String) } });
    });
  });

  describe("PUT (handling fields)", () => {
    const handling = {
      driver: "Per",
      secondDriver: "",
      driverInfo: "Ring først",
      licensePlate: "EL 12345",
      deviation: "Custom",
      customDeviation: { price: 400, subcontractorPrice: 200, description: "Ventetid" },
      dontSendEmail: true,
      description: "Intern",
      expressDelivery: true,
      rabatt: "100",
      leggTil: "50",
      deliveryDate: "2026-10-10",
      timeWindow: "08:00-16:00",
    };

    it("moves the delivery date and time window on the order and in the booking details, and logs it", async () => {
      const res = await put({ handling: { ...handling, deliveryDate: "2026-10-14", timeWindow: "16:00-21:00" } });
      expect(res.status).toBe(200);

      const [target, , data] = mocks.pricingWritesMock.mock.calls[0]!;
      expect(data).toMatchObject({ deliveryDate: "2026-10-14", timeWindow: "16:00-21:00" });
      expect(target.websiteBookingDetails).toMatchObject({ preferredDate: "2026-10-14", timeWindow: "16:00-21:00" });
      expect(mocks.createOrderUpdatedEventMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          changes: expect.arrayContaining([
            expect.objectContaining({ field: "deliveryDate", previousValue: "2026-10-10", nextValue: "2026-10-14" }),
            expect.objectContaining({ field: "timeWindow", previousValue: "08:00-16:00", nextValue: "16:00-21:00" }),
          ]),
        }),
      );
    });

    it("saves them and re-prices with express, discount, extra and the deviation — products as stored", async () => {
      const res = await put({ handling });
      expect(res.status).toBe(200);

      const [pricedOrder, cards] = mocks.recomputeMock.mock.calls[0]!;
      expect(cards).toEqual([card(0, "p-wm")]);
      expect(pricedOrder).toMatchObject({
        expressDelivery: true,
        rabatt: "100",
        leggTil: "50",
        deviation: "Custom",
        customDeviation: { price: 400, subcontractorPrice: 200, description: "Ventetid" },
      });
      const [, , data] = mocks.pricingWritesMock.mock.calls[0]!;
      expect(data).toMatchObject({
        driver: "Per",
        secondDriver: null,
        driverInfo: "Ring først",
        licensePlate: "EL 12345",
        deviation: "Custom",
        dontSendEmail: true,
        description: "Intern",
        expressDelivery: true,
        rabatt: "100",
        leggTil: "50",
      });
      expect(mocks.createOrderUpdatedEventMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          changes: expect.arrayContaining([expect.objectContaining({ field: "driver", previousValue: "", nextValue: "Per" })]),
        }),
      );
    });

    it("keeps what a save leaves out — the calculator sends only discount, extra and partner minus/plus", async () => {
      mocks.orderFindFirstMock.mockResolvedValue(order({ driver: "Per", licensePlate: "EL 1", expressDelivery: true }));
      const res = await put({ handling: { rabatt: "200", leggTil: "", subcontractorMinus: "74", subcontractorPlus: "10" } });
      expect(res.status).toBe(200);

      const [pricedOrder] = mocks.recomputeMock.mock.calls[0]!;
      expect(pricedOrder).toMatchObject({ rabatt: "200", subcontractorMinus: "74", subcontractorPlus: "10", expressDelivery: true });
      const [, , data] = mocks.pricingWritesMock.mock.calls[0]!;
      expect(data).toMatchObject({
        driver: "Per",
        licensePlate: "EL 1",
        expressDelivery: true,
        deliveryDate: "2026-10-10",
        rabatt: "200",
        subcontractorMinus: "74",
        subcontractorPlus: "10",
      });
      expect(mocks.createOrderUpdatedEventMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          changes: expect.arrayContaining([
            expect.objectContaining({ field: "subcontractorMinus", previousValue: "", nextValue: "74" }),
          ]),
        }),
      );
    });

    it("lets them be saved on a completed order, where products and addresses stay locked", async () => {
      mocks.orderFindFirstMock.mockResolvedValue(order({ status: "completed" }));
      expect((await put({ handling })).status).toBe(200);
      expect((await put({ handling, productCards: [card(0, "p-wm")] })).status).toBe(409);
      expect((await put({ handling, details: editedDetails })).status).toBe(409);
    });

    it("returns the field errors for a bad discount or unknown deviation", async () => {
      const res = await put({ handling: { ...handling, rabatt: "abc", deviation: "Nope" } });
      expect(res.status).toBe(422);
      expect(await res.json()).toMatchObject({
        reason: "INVALID_HANDLING",
        errors: { rabatt: expect.any(String), deviation: expect.any(String) },
      });
    });
  });

  describe("PUT (preview)", () => {
    it("prices the change and compares it with what was paid, without saving or emailing", async () => {
      mocks.orderFindFirstMock.mockResolvedValue(paidOrder(100000));
      const res = await put({ ...twoCards, dryRun: true, sendPaymentLink: true });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toMatchObject({
        ok: true,
        dryRun: true,
        priceExVat: 1500,
        comparison: {
          outcome: "due",
          totalPaidIncVatNok: 1000,
          currentTotalIncVatNok: 1500,
          differenceIncVatNok: 500,
          hasPaidSnapshot: true,
        },
      });
      expect(mocks.transactionMock).not.toHaveBeenCalled();
      expect(mocks.sendLifecycleEmailsMock).not.toHaveBeenCalled();
      expect(mocks.createOrderUpdatedEventMock).not.toHaveBeenCalled();
    });

    it("returns the calculator — customer and partner side — for the change", async () => {
      const json = await (await put({ handling: { rabatt: "100" }, dryRun: true })).json();
      expect(json.calculator).toMatchObject({
        products: [{ name: "Vaskemaskin", lines: [{ label: "Levering", customer: 1500, partner: 400 }] }],
        customer: { total: 1500 },
        partner: { base: 400, total: 400 },
      });
    });

    it("flags a refund when the change makes a paid order cheaper", async () => {
      mocks.orderFindFirstMock.mockResolvedValue(paidOrder(100000));
      mocks.recomputeMock.mockResolvedValue(recomputed(800));
      const json = await (await put({ ...twoCards, dryRun: true })).json();
      expect(json.comparison).toMatchObject({ outcome: "refund", differenceIncVatNok: -200 });
    });
  });

  describe("PUT (save & send payment link)", () => {
    it("approves a new order, mints its action token and sends the payment request", async () => {
      const res = await put({ ...twoCards, sendPaymentLink: true });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toMatchObject({ ok: true, emailSent: "payment_request" });
      const [, , data] = mocks.pricingWritesMock.mock.calls[0]!;
      expect(data).toMatchObject({
        lastEditedByMembershipId: "m1",
        status: "approved",
        approvedAt: expect.any(Date),
        statusChangedAt: expect.any(Date),
        actionToken: expect.any(String),
      });
      expect(mocks.resolveAllOrderNotificationsMock).toHaveBeenCalled();
      const sent = mocks.sendLifecycleEmailsMock.mock.calls[0]![0];
      expect(sent.kind).toBe("payment_request");
      expect(sent.orders[0]).toMatchObject({ id: "order-1", email: "kari@example.no", actionToken: data.actionToken });
      expect(mocks.createOrderUpdatedEventMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          changes: expect.arrayContaining([expect.objectContaining({ field: "status", nextValue: "approved" })]),
        }),
      );
    });

    it("keeps an existing action token and status for an order already waiting on payment", async () => {
      mocks.orderFindFirstMock.mockResolvedValue(order({ status: "approved", actionToken: "tok-existing" }));
      const res = await put({ ...twoCards, sendPaymentLink: true });
      expect(res.status).toBe(200);
      const [, , data] = mocks.pricingWritesMock.mock.calls[0]!;
      expect(data).toEqual({ lastEditedByMembershipId: "m1" });
      expect(mocks.sendLifecycleEmailsMock.mock.calls[0]![0].orders[0].actionToken).toBe("tok-existing");
    });

    it("sends the balance-due email, spelling out paid / new total / due and the changes", async () => {
      mocks.orderFindFirstMock.mockResolvedValue(paidOrder(100000));
      const res = await put({ ...twoCards, sendPaymentLink: true });
      expect(res.status).toBe(200);
      expect((await res.json()).emailSent).toBe("balance_due");
      const sent = mocks.sendLifecycleEmailsMock.mock.calls[0]![0];
      expect(sent.kind).toBe("balance_due");
      expect(sent.orders[0].balanceDue).toEqual({
        paidIncVatNok: 1000,
        totalIncVatNok: 1500,
        amountDueIncVatNok: 500,
        changes: expect.any(Array),
      });
    });

    it("saves nothing when there's no link to send", async () => {
      mocks.orderFindFirstMock.mockResolvedValue(paidOrder(150000));
      let res = await put({ ...twoCards, sendPaymentLink: true });
      expect(res.status).toBe(409);
      expect((await res.json()).reason).toBe("NOTHING_TO_PAY");

      mocks.orderFindFirstMock.mockResolvedValue(order({ email: null }));
      res = await put({ ...twoCards, sendPaymentLink: true });
      expect(res.status).toBe(409);
      expect((await res.json()).reason).toBe("MISSING_CUSTOMER_EMAIL");

      expect(mocks.transactionMock).not.toHaveBeenCalled();
      expect(mocks.sendLifecycleEmailsMock).not.toHaveBeenCalled();
    });

    it("sends to the email entered in the same save", async () => {
      mocks.orderFindFirstMock.mockResolvedValue(order({ email: null }));
      const res = await put({
        details: { ...editedDetails, customer: { ...editedDetails.customer, email: "ny@example.no" } },
        sendPaymentLink: true,
      });
      expect(res.status).toBe(200);
      expect(mocks.sendLifecycleEmailsMock.mock.calls[0]![0].orders[0].email).toBe("ny@example.no");
    });

    it("reports a failed email after the order was saved", async () => {
      mocks.sendLifecycleEmailsMock.mockResolvedValue({ sentCount: 0, failedOrderIds: ["order-1"] });
      const res = await put({ ...twoCards, sendPaymentLink: true });
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json).toMatchObject({ ok: true, emailSent: null, emailFailed: true });
      expect(mocks.transactionMock).toHaveBeenCalled();
    });
  });
});
