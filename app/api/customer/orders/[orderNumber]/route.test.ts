import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCustomerSession: vi.fn(),
  orderFindFirst: vi.fn(),
  orderUpdate: vi.fn(),
  transaction: vi.fn(),
  getWebsiteOrderCatalog: vi.fn(),
  validateWebsiteOrderCards: vi.fn(),
  recompute: vi.fn(),
  pricingWrites: vi.fn(),
  resolveDrivingDistance: vi.fn(),
  createOrderUpdatedEvent: vi.fn(),
  createOrderNotification: vi.fn(),
  sendLifecycleEmails: vi.fn(),
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
  return { ...actual, recomputeWebsiteOrderPricing: mocks.recompute, websiteOrderPricingWrites: mocks.pricingWrites };
});
vi.mock("@/lib/orders/resolveDrivingDistance", () => ({ resolveDrivingDistance: mocks.resolveDrivingDistance }));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderUpdatedEvent: mocks.createOrderUpdatedEvent }));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: mocks.createOrderNotification }));
vi.mock("@/lib/orders/sendCustomerLifecycleEmail", () => ({ sendLifecycleEmailsForOrders: mocks.sendLifecycleEmails }));

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
    ...overrides,
  };
}

// After the cutoff: job tomorrow at 10:00 Oslo, cutoff today 08:00Z.
const afterCutoff = { deliveryDate: "2026-10-06", timeWindow: "10:00-16:00" };

function recomputed(priceExVat: number, cards: unknown[] = [washerCard]) {
  return { cards, builtItems: [], summaries: {}, pricingSnapshot: null, priceExVat, priceSubcontractor: 0, orderExtras: [], pricingResult: {} };
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
      });
      expect(json.details.customer).toMatchObject({ name: "Kari", phone: "87654321", email: "kari@example.no" });
      expect(json.productCards).toEqual([normalizeSavedProductCard(washerCard as never, 0)]);
      expect(json.pricingContext).toMatchObject({ expressDelivery: false, rabatt: "", leggTil: "" });
      expect(JSON.stringify(json)).not.toContain("priceSubcontractor");
      expect(JSON.stringify(json)).not.toContain("subcontractorMinus");
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

      const res = await put({ productCards: cards, shownTotal: 1300 });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toMatchObject({ ok: true, previousPriceExVat: 1000, priceExVat: 1300 });
      expect(mocks.recompute).toHaveBeenCalledWith(expect.anything(), [normalizeSavedProductCard(cards[0] as never, 0)]);
      expect(mocks.createOrderNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ message: expect.stringContaining("300") }),
      );
    });

    it("previews a change with dryRun without saving", async () => {
      mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(1300, cards));

      const res = await put({ productCards: [{ ...washerCard, amount: 2 }], dryRun: true });

      expect(await res.json()).toEqual({ ok: true, dryRun: true, previousPriceExVat: 1000, priceExVat: 1300 });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("needs the shown total when the price changes, and refuses a stale one", async () => {
      mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(1300, cards));
      const cards = [{ ...washerCard, amount: 2 }];

      expect((await put({ productCards: cards })).status).toBe(400);
      const stale = await put({ productCards: cards, shownTotal: 1200 });
      expect(stale.status).toBe(409);
      expect(await stale.json()).toEqual({ ok: false, reason: "PRICE_CHANGED", priceExVat: 1300 });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("lets the customer add a new product before the cutoff", async () => {
      const cards = [washerCard, { ...washerCard, cardId: 1, productId: "p-dryer" }];
      mocks.recompute.mockImplementation(async (_order: unknown, c: unknown[]) => recomputed(1800, c));

      const res = await put({ productCards: cards, shownTotal: 1800 });

      expect(res.status).toBe(200);
    });

    it("refuses an invalid product card", async () => {
      mocks.validateWebsiteOrderCards.mockReturnValue({ ok: false, reason: "UNKNOWN_PRODUCT" });
      const res = await put({ productCards: [{ ...washerCard, productId: "nope" }], shownTotal: 1000 });
      expect(res.status).toBe(422);
      expect((await res.json()).reason).toBe("UNKNOWN_PRODUCT");
    });

    it("refuses a cheaper order once something has been paid (refunds aren't built)", async () => {
      mocks.orderFindFirst.mockResolvedValue(
        order({ status: "confirmed", payments: [{ amountChargedCents: 100000, createdAt: NOW, orderSnapshot: null }] }),
      );
      mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(800, cards));

      const res = await put({ productCards: [{ ...washerCard, selectedExtraOptionIds: ["NO_PACKAGING_REMOVAL"] }], shownTotal: 800 });

      expect(res.status).toBe(422);
      expect((await res.json()).reason).toBe("WOULD_DECREASE_PRICE");
    });

    it("lets an unpaid order get cheaper", async () => {
      mocks.recompute.mockImplementation(async (_order: unknown, cards: unknown[]) => recomputed(800, cards));
      const res = await put({ productCards: [{ ...washerCard, selectedExtraOptionIds: ["NO_PACKAGING_REMOVAL"] }], shownTotal: 800 });
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
