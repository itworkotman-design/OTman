import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCustomerSession: vi.fn(),
  orderFindFirst: vi.fn(),
  orderUpdate: vi.fn(),
  transaction: vi.fn(),
  getWebsiteOrderCatalog: vi.fn(),
  validateWebsiteOrderCards: vi.fn(),
  recompute: vi.fn(),
  resolvePricing: vi.fn(),
  pricingWrites: vi.fn(),
  resolveDrivingDistance: vi.fn(),
  createOrderUpdatedEvent: vi.fn(),
  createOrderStatusChangedEvent: vi.fn(),
  createOrderNotification: vi.fn(),
  sendLifecycleEmails: vi.fn(),
  startPaidChangeCheckout: vi.fn(),
}));

vi.mock("@/lib/customerAccounts/customerSession", () => ({ getCustomerSession: mocks.getCustomerSession }));
vi.mock("@/lib/db", () => ({
  prisma: { order: { findFirst: mocks.orderFindFirst, update: mocks.orderUpdate }, $transaction: mocks.transaction },
}));
vi.mock("@/lib/content/websiteOrderCatalog", () => ({
  getWebsiteOrderCatalog: mocks.getWebsiteOrderCatalog,
  listSeededWebsiteCatalogs: async () => [],
}));
vi.mock("@/lib/orders/validateWebsiteOrderCards", () => ({ validateWebsiteOrderCards: mocks.validateWebsiteOrderCards }));
// The pricing pipeline has its own tests; here only this route's decisions.
vi.mock("@/lib/orders/websiteOrderRepricing", async () => {
  const actual = await vi.importActual<typeof import("@/lib/orders/websiteOrderRepricing")>("@/lib/orders/websiteOrderRepricing");
  return {
    ...actual,
    recomputeWebsiteOrderPricing: mocks.recompute,
    resolveSavedCatalogPricing: mocks.resolvePricing,
    websiteOrderPricingWrites: mocks.pricingWrites,
  };
});
vi.mock("@/lib/orders/resolveDrivingDistance", () => ({ resolveDrivingDistance: mocks.resolveDrivingDistance }));
vi.mock("@/lib/orders/orderEvents", () => ({
  createOrderUpdatedEvent: mocks.createOrderUpdatedEvent,
  createOrderStatusChangedEvent: mocks.createOrderStatusChangedEvent,
}));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: mocks.createOrderNotification }));
vi.mock("@/lib/orders/sendCustomerLifecycleEmail", () => ({ sendLifecycleEmailsForOrders: mocks.sendLifecycleEmails }));
vi.mock("@/lib/customerAccounts/customerOrderPaidChange", () => ({ startPaidChangeCheckout: mocks.startPaidChangeCheckout }));

import { normalizeSavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { GET, PUT } from "./route";

const NOW = new Date("2026-10-05T10:00:00Z");

const storePickup = {
  source: "store",
  placeName: "Power",
  address: "Strømmen 1",
  floor: null,
  liftAvailable: false,
  contactName: "",
  contactPhone: "",
  cardIds: [0],
};

const washerCard = {
  cardId: 0,
  productId: "p-wm",
  amount: 1,
  deliveryType: "firstStep",
  selectedInstallOptionIds: [],
  selectedExtraOptionIds: [] as string[],
  modelNumber: "",
};

function bookingDetails(date: string, timeWindow: string) {
  return {
    version: 1,
    customerType: "private",
    pickups: [storePickup],
    delivery: { address: "Kirkegata 5", floor: 2, liftAvailable: false },
    preferredDate: date,
    timeWindow,
    drivingDistance: "21",
    orderExtras: [],
  };
}

// Before the cutoff by default (job on the 10th, cutoff 9th 06:00Z).
function order(overrides: Record<string, unknown> = {}) {
  const date = (overrides.deliveryDate as string) ?? "2026-10-10";
  const timeWindow = (overrides.timeWindow as string) ?? "08:00-16:00";
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
    deviation: null,
    actionToken: null,
    emailThreadToken: null,
    priceExVat: 1000,
    productsSummary: "Vaskemaskin",
    rabatt: null,
    leggTil: null,
    subcontractorMinus: null,
    subcontractorPlus: null,
    pricingSnapshot: null,
    pickupAddress: "Strømmen 1",
    deliveryAddress: "Kirkegata 5",
    deliveryDate: date,
    timeWindow,
    drivingDistance: "21",
    expressDelivery: false,
    floorNo: "2",
    lift: "no",
    extraPickupAddress: [],
    createdAt: new Date("2026-10-01T10:00:00Z"),
    gsmSentAt: null,
    websiteOrderKind: "WHITE_GOODS",
    websiteBookingDetails: bookingDetails(date, timeWindow),
    productCardsSnapshot: [washerCard],
    payments: [],
    events: [],
    items: [],
    ...overrides,
  };
}

// After the cutoff: job tomorrow at 10:00 Oslo, cutoff today 08:00Z.
const afterCutoff = { deliveryDate: "2026-10-06", timeWindow: "10:00-16:00" };

// Prices are ex. VAT; the customer sees and confirms the total incl. VAT.
function recomputed(priceExVat: number, cards: unknown[] = [washerCard]) {
  return {
    cards,
    builtItems: [],
    summaries: {},
    pricingSnapshot: null,
    priceExVat,
    priceSubcontractor: 0,
    orderExtras: [],
    pricingResult: {},
    customerTotals: { totalExVat: priceExVat, totalIncVat: priceExVat * 1.25, vat: priceExVat * 0.25 },
  };
}

const params = { params: Promise.resolve({ orderNumber: "583920" }) };

function put(body: unknown) {
  return PUT(new Request("http://localhost/api/customer/orders/583920", { method: "PUT", body: JSON.stringify(body) }), params);
}

describe("customer order route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    mocks.getCustomerSession.mockResolvedValue({ sessionId: "s1", accountId: "acc-1", email: "kari@example.no" });
    mocks.orderFindFirst.mockResolvedValue(order());
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ priceListId: "pl", products: [], specialOptions: [], priceListSettings: {} });
    mocks.validateWebsiteOrderCards.mockImplementation((cards: unknown[]) => ({ ok: true, cards }));
    mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(1000, cards));
    mocks.pricingWrites.mockReturnValue(["writes"]);
    mocks.transaction.mockResolvedValue([]);
    mocks.resolveDrivingDistance.mockResolvedValue("21");
    mocks.sendLifecycleEmails.mockResolvedValue({ sentCount: 1, failedOrderIds: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("GET", () => {
    it("needs a customer session", async () => {
      mocks.getCustomerSession.mockResolvedValue(null);
      const res = await GET(new Request("http://localhost"), params);
      expect(res.status).toBe(401);
    });

    it("only finds orders on the logged-in account, and says 404 for anyone else's", async () => {
      mocks.orderFindFirst.mockResolvedValue(null);
      const res = await GET(new Request("http://localhost"), params);
      expect(res.status).toBe(404);
      expect(mocks.orderFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { customerAccountId: "acc-1", orderNumber: "583920" } }),
      );
    });

    it("returns the order, its editable details and what can be changed — nothing internal", async () => {
      const res = await GET(new Request("http://localhost"), params);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.permissions).toEqual({
        open: true,
        beforeCutoff: true,
        cutoffAt: "2026-10-09T06:00:00.000Z",
        canEditItems: true,
        editableAfterCutoff: true,
      });
      expect(json.details.customer).toMatchObject({ name: "Kari", phone: "87654321", email: "kari@example.no" });
      expect(json.productCards).toEqual([normalizeSavedProductCard(washerCard as never, 0)]);
      expect(json.pricingContext).toMatchObject({ expressDelivery: false, rabatt: "", leggTil: "" });
      expect(JSON.stringify(json)).not.toContain("priceSubcontractor");
      expect(JSON.stringify(json)).not.toContain("subcontractorMinus");
    });
  });

  describe("catalog", () => {
    it("loads it once for the whole change — checking the products and every pricing", async () => {
      const catalog = { priceListId: "pl", products: [], specialOptions: [], priceListSettings: {} };
      mocks.getWebsiteOrderCatalog.mockResolvedValue(catalog);

      await put({ productCards: [{ ...washerCard, selectedExtraOptionIds: ["unpack"] }], shownTotal: 1250 });

      expect(mocks.getWebsiteOrderCatalog).toHaveBeenCalledTimes(1);
      expect(mocks.resolvePricing.mock.calls[0]![3]).toEqual({ catalog });
      expect(mocks.recompute.mock.calls[0]![2]).toMatchObject({ catalog });
    });
  });

  describe("pricing guard", () => {
    it("refuses a change whose prices would leave a product's delivery or option out", async () => {
      mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => ({ ...recomputed(1200, cards), missingPriceCardIds: [0] }));
      const res = await put({ productCards: [{ ...washerCard, selectedExtraOptionIds: ["unpack"] }], shownTotal: 1500 });

      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ reason: "PRICING_INCOMPLETE" });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  });

  describe("pickup assignment", () => {
    it("refuses a product added to a split order that no pickup stop collects", async () => {
      const homePickup = { ...storePickup, source: "home", placeName: "", address: "Bjerkeveien 2", floor: 1, cardIds: [1] };
      const sofaCard = { ...washerCard, cardId: 1, productId: "p-sofa" };
      mocks.orderFindFirst.mockResolvedValue(
        order({
          productCardsSnapshot: [washerCard, sofaCard],
          websiteBookingDetails: { ...bookingDetails("2026-10-10", "08:00-16:00"), pickups: [storePickup, homePickup] },
        }),
      );

      const res = await put({ productCards: [washerCard, sofaCard, { ...washerCard, cardId: 2 }], shownTotal: 1000 });

      expect(res.status).toBe(422);
      expect((await res.json()).reason).toBe("PRODUCT_WITHOUT_PICKUP");
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("refuses a pickup address that collects no products", async () => {
      const res = await put({ pickups: [storePickup, { ...storePickup, address: "Bjerkeveien 2", cardIds: [] }] });

      expect(res.status).toBe(422);
      expect(await res.json()).toMatchObject({ reason: "PICKUP_WITHOUT_PRODUCT", pickups: [1] });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("still lets an older order that already has an empty pickup change its contact details", async () => {
      mocks.orderFindFirst.mockResolvedValue(
        order({
          websiteBookingDetails: {
            ...bookingDetails("2026-10-10", "08:00-16:00"),
            pickups: [storePickup, { ...storePickup, address: "Bjerkeveien 2", cardIds: [] }],
          },
        }),
      );

      const res = await put({ customer: { name: "Kari Nordmann" } });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true, changed: true });
    });

    it("doesn't save a contact person on a store pickup", async () => {
      const res = await put({ pickups: [{ ...storePickup, contactName: "Ola", contactPhone: "12345678" }] });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true, changed: false });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  });

  describe("rejected orders", () => {
    it("shows the customer the rejection comment while the order is rejected", async () => {
      mocks.orderFindFirst.mockResolvedValue(order({ status: "rejected", statusNotes: "Vi leverer ikke til den adressen." }));

      const json = await (await GET(new Request("http://localhost"), params)).json();

      expect(json.order.rejectionNote).toBe("Vi leverer ikke til den adressen.");
    });

    it("keeps status notes internal on any other status", async () => {
      mocks.orderFindFirst.mockResolvedValue(order({ status: "processing", statusNotes: "Ring kunden før levering" }));

      const json = await (await GET(new Request("http://localhost"), params)).json();

      expect(json.order.rejectionNote).toBeNull();
      expect(JSON.stringify(json)).not.toContain("Ring kunden");
    });

    it("sends a rejected order back to processing when the customer changes it", async () => {
      mocks.orderFindFirst.mockResolvedValue(order({ status: "rejected", statusNotes: "Feil adresse" }));

      const res = await put({ customer: { phone: "91234567" } });

      expect(res.status).toBe(200);
      const data = mocks.pricingWrites.mock.calls[0][2];
      expect(data).toMatchObject({ status: "processing", statusChangedAt: expect.any(Date) });
      expect(mocks.createOrderStatusChangedEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ orderId: "order-1", fromStatus: "rejected", toStatus: "processing" }),
      );
      expect(mocks.createOrderNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ message: expect.stringContaining("back to processing") }),
      );
    });

    it("leaves the status alone when the order wasn't rejected", async () => {
      const res = await put({ customer: { phone: "91234567" } });

      expect(res.status).toBe(200);
      expect(mocks.pricingWrites.mock.calls[0][2]).not.toHaveProperty("status");
      expect(mocks.createOrderStatusChangedEvent).not.toHaveBeenCalled();
    });
  });

  describe("PUT", () => {
    it("refuses changes to a closed order", async () => {
      mocks.orderFindFirst.mockResolvedValue(order({ status: "completed" }));
      const res = await put({ customer: { phone: "91234567" } });
      expect(res.status).toBe(409);
      expect((await res.json()).reason).toBe("ORDER_CLOSED");
    });

    it("lets the customer change their phone after the cutoff, and tells staff", async () => {
      mocks.orderFindFirst.mockResolvedValue(order(afterCutoff));

      const res = await put({ customer: { phone: "91234567" } });

      expect(res.status).toBe(200);
      expect(mocks.transaction).toHaveBeenCalled();
      const data = mocks.pricingWrites.mock.calls[0][2];
      expect(data).toMatchObject({ phone: "91234567" });
      expect(mocks.createOrderNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ orderId: "order-1", type: "MANUAL_REVIEW", message: expect.stringContaining("91234567") }),
      );
      expect(mocks.createOrderUpdatedEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ actor: { source: "SYSTEM", name: "Customer" } }),
      );
      expect(mocks.sendLifecycleEmails).toHaveBeenCalledWith(expect.objectContaining({ kind: "order_updated" }));
    });

    it("refuses an address change after the cutoff", async () => {
      mocks.orderFindFirst.mockResolvedValue(order(afterCutoff));

      const res = await put({ delivery: { address: "Annen vei 3", floor: 2, liftAvailable: false } });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json).toEqual({ ok: false, reason: "EDIT_NOT_ALLOWED", forbidden: ["addresses"] });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("lets the customer add unpacking after the cutoff, re-priced, when they confirm the shown price", async () => {
      mocks.orderFindFirst.mockResolvedValue(order(afterCutoff));
      mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(1300, cards));
      const cards = [{ ...washerCard, selectedExtraOptionIds: ["UNPACKING"] }];

      const res = await put({ productCards: cards, shownTotal: 1625 });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toMatchObject({ ok: true, previousPriceExVat: 1000, priceExVat: 1300, previousTotalIncVat: 1250, totalIncVat: 1625 });
      expect(mocks.recompute).toHaveBeenCalledWith(expect.anything(), [normalizeSavedProductCard(cards[0] as never, 0)], expect.anything());
      expect(mocks.createOrderNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ message: expect.stringContaining("300") }),
      );
    });

    // Like the admin editor: the order keeps the prices it was saved with —
    // only what the customer adds is priced at today's catalog.
    it("prices a change with the order's saved catalog prices", async () => {
      const saved = { productOptions: { saved: true } };
      mocks.resolvePricing.mockResolvedValue(saved);
      mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(1300, cards));

      await put({ productCards: [{ ...washerCard, amount: 2 }], dryRun: true });

      expect(mocks.resolvePricing).toHaveBeenCalledWith(expect.objectContaining({ id: "order-1" }), [normalizeSavedProductCard(washerCard as never, 0)], [], { catalog: expect.anything() });
      expect(mocks.recompute.mock.calls[0]![2]).toMatchObject({ catalogPricing: saved });
    });

    it("previews a change with dryRun without saving", async () => {
      mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(1300, cards));

      const res = await put({ productCards: [{ ...washerCard, amount: 2 }], dryRun: true });

      expect(await res.json()).toEqual({
        ok: true,
        dryRun: true,
        previousPriceExVat: 1000,
        priceExVat: 1300,
        // What the customer is shown: incl. VAT.
        previousTotalIncVat: 1250,
        totalIncVat: 1625,
      });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("needs the shown total when the price changes, and refuses a stale one", async () => {
      mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(1300, cards));
      const cards = [{ ...washerCard, amount: 2 }];

      expect((await put({ productCards: cards })).status).toBe(400);
      // The ex-VAT price isn't what the customer saw — the incl.-VAT total is.
      const exVat = await put({ productCards: cards, shownTotal: 1300 });
      expect(exVat.status).toBe(409);
      const stale = await put({ productCards: cards, shownTotal: 1200 });
      expect(stale.status).toBe(409);
      expect(await stale.json()).toEqual({ ok: false, reason: "PRICE_CHANGED", priceExVat: 1300, totalIncVat: 1625 });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("lets the customer add a new product before the cutoff", async () => {
      const cards = [washerCard, { ...washerCard, cardId: 1, productId: "p-dryer" }];
      mocks.recompute.mockImplementation(async (_order: unknown, c: unknown[]) => recomputed(1800, c));

      const res = await put({ productCards: cards, shownTotal: 2250 });

      expect(res.status).toBe(200);
    });

    it("refuses an invalid product card", async () => {
      mocks.validateWebsiteOrderCards.mockReturnValue({ ok: false, reason: "UNKNOWN_PRODUCT" });
      const res = await put({ productCards: [{ ...washerCard, productId: "nope" }], shownTotal: 1000 });
      expect(res.status).toBe(422);
      expect((await res.json()).reason).toBe("UNKNOWN_PRODUCT");
    });

    describe("a paid order (1250 kr incl. VAT paid)", () => {
      const paidOrder = (overrides: Record<string, unknown> = {}) => order({ status: "confirmed", payments: [{ amountChargedCents: 125000, createdAt: NOW, orderSnapshot: null, refunds: [] }], ...overrides });
      const dearerCards = [{ ...washerCard, selectedExtraOptionIds: ["INSTALL"] }];

      beforeEach(() => {
        mocks.startPaidChangeCheckout.mockResolvedValue({ url: "https://checkout.stripe.test/s1" });
      });

      it("previews what the customer pays now for a dearer change", async () => {
        mocks.orderFindFirst.mockResolvedValue(paidOrder());
        mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(1200, cards));

        const json = await (await put({ productCards: dearerCards, dryRun: true })).json();

        expect(json).toMatchObject({ dryRun: true, totalIncVat: 1500, payNowIncVat: 250 });
      });

      it("doesn't save a dearer change — it's held and the customer is sent to pay the difference first", async () => {
        mocks.orderFindFirst.mockResolvedValue(paidOrder());
        mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(1200, cards));

        const res = await put({ productCards: dearerCards, shownTotal: 1500 });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          ok: true,
          paymentRequired: true,
          amountDueIncVat: 250,
          totalIncVat: 1500,
          checkoutUrl: "https://checkout.stripe.test/s1",
        });
        expect(mocks.startPaidChangeCheckout).toHaveBeenCalledWith(
          expect.objectContaining({ amountDueCents: 25000, totalIncVat: 1500, body: { productCards: dearerCards, shownTotal: 1500 } }),
        );
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.createOrderNotification).not.toHaveBeenCalled();
        expect(mocks.sendLifecycleEmails).not.toHaveBeenCalled();
      });

      it("…also within 24h, while the job is under way (adding a service with the driver there)", async () => {
        mocks.orderFindFirst.mockResolvedValue(paidOrder({ ...afterCutoff, status: "active" }));
        mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(1200, cards));

        const json = await (await put({ productCards: dearerCards, shownTotal: 1500 })).json();

        expect(json.paymentRequired).toBe(true);
        expect(mocks.transaction).not.toHaveBeenCalled();
      });

      it("still checks the shown price before sending anyone to pay", async () => {
        mocks.orderFindFirst.mockResolvedValue(paidOrder());
        mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(1200, cards));

        const res = await put({ productCards: dearerCards, shownTotal: 1400 });

        expect(res.status).toBe(409);
        expect(mocks.startPaidChangeCheckout).not.toHaveBeenCalled();
      });

      it("reports a failure to start the payment, saving nothing", async () => {
        mocks.orderFindFirst.mockResolvedValue(paidOrder());
        mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(1200, cards));
        mocks.startPaidChangeCheckout.mockRejectedValue(new Error("stripe down"));

        const res = await put({ productCards: dearerCards, shownTotal: 1500 });

        expect(res.status).toBe(502);
        expect((await res.json()).reason).toBe("PAYMENT_START_FAILED");
        expect(mocks.transaction).not.toHaveBeenCalled();
      });

      it("saves a cheaper change before the cutoff and sends a confirmed order back to processing (refund on confirm)", async () => {
        mocks.orderFindFirst.mockResolvedValue(paidOrder());
        mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(800, cards));

        const res = await put({ productCards: [{ ...washerCard, selectedExtraOptionIds: ["NO_PACKAGING_REMOVAL"] }], shownTotal: 1000 });

        expect(res.status).toBe(200);
        expect(mocks.pricingWrites.mock.calls[0][2]).toMatchObject({ status: "processing" });
        const alert = mocks.createOrderNotification.mock.calls[0][1];
        expect(alert.message).toContain("refunded");
        expect(mocks.createOrderStatusChangedEvent).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ fromStatus: "confirmed", toStatus: "processing" }),
        );
      });

      it("tells the customer, in the preview and after saving, what is refunded once staff have reviewed a cheaper change", async () => {
        mocks.orderFindFirst.mockResolvedValue(paidOrder());
        mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(800, cards));
        const cheaper = [{ ...washerCard, selectedExtraOptionIds: ["NO_PACKAGING_REMOVAL"] }];

        const preview = await (await put({ productCards: cheaper, dryRun: true })).json();
        expect(preview).toMatchObject({ totalIncVat: 1000, refundOnReviewIncVat: 250 });

        const saved = await (await put({ productCards: cheaper, shownTotal: 1000 })).json();
        expect(saved).toMatchObject({ changed: true, refundOnReviewIncVat: 250 });
      });

      it("refuses a cheaper change within 24h — only additions then", async () => {
        mocks.orderFindFirst.mockResolvedValue(paidOrder(afterCutoff));
        mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(800, cards));

        const res = await put({ productCards: [{ ...washerCard, selectedExtraOptionIds: ["NO_PACKAGING_REMOVAL"] }], shownTotal: 1000 });

        expect(res.status).toBe(422);
        expect((await res.json()).reason).toBe("WOULD_DECREASE_PRICE");
        expect(mocks.transaction).not.toHaveBeenCalled();
      });
    });

    it("lets an unpaid order get cheaper", async () => {
      mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(800, cards));
      const res = await put({ productCards: [{ ...washerCard, selectedExtraOptionIds: ["NO_PACKAGING_REMOVAL"] }], shownTotal: 1000 });
      expect(res.status).toBe(200);
    });

    it("refuses a new date that is already inside its own 24h", async () => {
      const res = await put({ preferredDate: "2026-10-06", timeWindow: "10:00-16:00" });
      expect(res.status).toBe(422);
      expect((await res.json()).reason).toBe("INVALID_SCHEDULE");
    });

    it("accepts a new date further ahead", async () => {
      const res = await put({ preferredDate: "2026-10-12", timeWindow: "16:00-21:00" });
      expect(res.status).toBe(200);
      expect(mocks.pricingWrites.mock.calls[0][2]).toMatchObject({ deliveryDate: "2026-10-12", timeWindow: "16:00-21:00" });
    });

    it("refuses a bad phone number or an emptied name", async () => {
      expect((await put({ customer: { phone: "abc" } })).status).toBe(422);
      expect((await put({ customer: { name: "  " } })).status).toBe(422);
    });

    it("on a non-catalog order (moving, quotes) only changes contact, notes and date — no re-pricing", async () => {
      mocks.orderFindFirst.mockResolvedValue(order({ websiteOrderKind: null, websiteBookingDetails: null, productCardsSnapshot: null }));

      const ok = await put({ customer: { comments: "Ring på døren" }, preferredDate: "2026-10-12", timeWindow: "10:00-16:00" });
      expect(ok.status).toBe(200);
      expect(mocks.recompute).not.toHaveBeenCalled();
      expect(mocks.orderUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "order-1" },
          data: expect.objectContaining({ customerComments: "Ring på døren", deliveryDate: "2026-10-12", timeWindow: "10:00-16:00" }),
        }),
      );

      const refused = await put({ productCards: [washerCard], shownTotal: 1000 });
      expect(refused.status).toBe(403);
    });

    it("does nothing when nothing changed", async () => {
      const res = await put({ customer: { phone: "87654321" } });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true, changed: false });
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.createOrderNotification).not.toHaveBeenCalled();
    });
  });
});
