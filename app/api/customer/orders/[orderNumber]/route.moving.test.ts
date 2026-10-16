import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// "My order" for a homepage move: the same 24h policy as a delivery order —
// anything until 24h before the job, then only adding services.

const mocks = vi.hoisted(() => ({
  getCustomerSession: vi.fn(),
  orderFindFirst: vi.fn(),
  orderUpdate: vi.fn((arg) => ({ op: "order.update", arg })),
  itemDeleteMany: vi.fn((arg) => ({ op: "items.deleteMany", arg })),
  itemCreateMany: vi.fn((arg) => ({ op: "items.createMany", arg })),
  transaction: vi.fn(),
  getMovingCatalog: vi.fn(),
  getRouteDistance: vi.fn(),
  createOrderUpdatedEvent: vi.fn(),
  createOrderStatusChangedEvent: vi.fn(),
  createOrderNotification: vi.fn(),
  sendLifecycleEmails: vi.fn(),
}));

vi.mock("@/lib/customerAccounts/customerSession", () => ({ getCustomerSession: mocks.getCustomerSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findFirst: mocks.orderFindFirst, update: mocks.orderUpdate },
    orderItem: { deleteMany: mocks.itemDeleteMany, createMany: mocks.itemCreateMany },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/content/getMovingCatalog", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content/getMovingCatalog")>("@/lib/content/getMovingCatalog");
  return { ...actual, getMovingCatalog: mocks.getMovingCatalog };
});
vi.mock("@/lib/integrations/mapbox/routeDistance", () => ({ getRouteDistance: mocks.getRouteDistance }));
vi.mock("@/lib/orders/orderEvents", () => ({
  createOrderUpdatedEvent: mocks.createOrderUpdatedEvent,
  createOrderStatusChangedEvent: mocks.createOrderStatusChangedEvent,
}));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: mocks.createOrderNotification }));
vi.mock("@/lib/orders/sendCustomerLifecycleEmail", () => ({ sendLifecycleEmailsForOrders: mocks.sendLifecycleEmails }));

import { GET, PUT } from "./route";

const NOW = new Date("2026-10-05T10:00:00Z");
const opt = (code: string, labelEn: string, customerPriceCents: number, subcontractorPriceCents = 0) => ({
  code,
  labelEn,
  labelNo: labelEn,
  customerPriceCents,
  subcontractorPriceCents,
});

const apartment = { homeType: "APARTMENT", sizeOptionCode: "SIZE_UNDER_40", floors: 1, floorNumber: 1, hasLift: null, parking: "OUTSIDE" };
const house = { homeType: "DETACHED", sizeOptionCode: "SIZE_UNDER_40", floors: 2, floorNumber: null, hasLift: null, parking: "OUTSIDE" };
const moving = {
  pickupAddress: "Karl Johans gate 1, Oslo",
  deliveryAddress: "Storgata 1, Oslo",
  origin: apartment,
  destination: house,
  serviceCodes: ["SERVICE_NEDPAKKING"],
};

// Booked at 5 000 (size) + 4 000 (packing) ex. VAT; customer pays 11 250.
function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    companyId: "c1",
    displayId: 42,
    orderNumber: "583920",
    status: "processing",
    customerName: "Kari",
    phone: "+47 12345678",
    email: "kari@example.no",
    customerComments: null,
    description: "Moving from: …",
    priceExVat: 9000,
    rabatt: null,
    leggTil: null,
    pricingSnapshot: { customer: { totalExVat: 9000, totalIncVat: 11250 }, lines: [] },
    pickupAddress: moving.pickupAddress,
    deliveryAddress: moving.deliveryAddress,
    extraPickupAddress: [],
    deliveryDate: "2026-10-10",
    timeWindow: "10:00-16:00",
    drivingDistance: "3",
    productsSummary: "Moving (Under 40 m²) + Packing",
    gsmSentAt: null,
    websiteOrderKind: "MOVING",
    websiteBookingDetails: { version: 1, customerType: "private", origin: apartment, destination: house, serviceCodes: ["SERVICE_NEDPAKKING"] },
    productCardsSnapshot: null,
    payments: [],
    events: [],
    items: [],
    ...overrides,
  };
}

// Job tomorrow 10:00 Oslo: the cutoff (today 08:00Z) has passed.
const afterCutoff = { deliveryDate: "2026-10-06", timeWindow: "10:00-16:00" };

const params = { params: Promise.resolve({ orderNumber: "583920" }) };
function put(body: unknown) {
  return PUT(new Request("http://localhost/api/customer/orders/583920", { method: "PUT", body: JSON.stringify(body) }), params);
}

describe("customer order route — a homepage move", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    mocks.getCustomerSession.mockResolvedValue({ sessionId: "s1", accountId: "acc-1", email: "kari@example.no" });
    mocks.orderFindFirst.mockResolvedValue(order());
    mocks.transaction.mockResolvedValue([]);
    mocks.getRouteDistance.mockResolvedValue({ distanceKm: "42.86", stopAddresses: [] });
    mocks.sendLifecycleEmails.mockResolvedValue({ sentCount: 1, failedOrderIds: [] });
    mocks.getMovingCatalog.mockResolvedValue({
      priceListId: "pl",
      options: [opt("SIZE_UNDER_40", "Under 40 m²", 500000), opt("SIZE_UNDER_100", "Under 100 m²", 1200000)],
      services: [opt("SERVICE_NEDPAKKING", "Packing", 400000), opt("SERVICE_FLYTTEVASK", "Move-out cleaning", 480000)],
      floorSurcharge: null,
      carrySurcharges: [],
      distanceRates: { kmFrom21: opt("KM_FROM_21", "Per km", 2890), kmOver100: opt("KM_OVER_100", "Per km", 2890) },
    });
  });

  afterEach(() => vi.useRealTimers());

  it("prices a change before saving (dryRun) — incl. VAT, what the customer sees", async () => {
    const json = await (await put({ moving: { ...moving, origin: { ...apartment, sizeOptionCode: "SIZE_UNDER_100" } }, dryRun: true })).json();
    expect(json).toMatchObject({ ok: true, dryRun: true, previousPriceExVat: 9000, priceExVat: 16000, previousTotalIncVat: 11250, totalIncVat: 20000 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("re-prices and saves a changed move before the cutoff, re-checking the distance when an address moved", async () => {
    const changed = { ...moving, deliveryAddress: "Bragernes torg 1, Drammen" };
    // The km line: 1 243 kr ex. VAT → 1 554 incl. (each line rounded, websiteVat.ts).
    const res = await put({ moving: changed, shownTotal: 11250 + 1554 });
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(mocks.getRouteDistance).toHaveBeenCalledWith({ pickupAddress: moving.pickupAddress, deliveryAddress: "Bragernes torg 1, Drammen" });
    const ops = mocks.transaction.mock.calls[0][0];
    expect(ops.map((op: { op: string }) => op.op)).toEqual(["items.deleteMany", "items.createMany", "order.update"]);
    expect(mocks.orderUpdate.mock.calls[0][0].data).toMatchObject({ deliveryAddress: "Bragernes torg 1, Drammen", drivingDistance: "42.86" });
  });

  it("keeps a discount staff gave the move when the customer changes it", async () => {
    mocks.orderFindFirst.mockResolvedValue(order({ rabatt: "1000", priceExVat: 8000, pricingSnapshot: { customer: { totalExVat: 8000, totalIncVat: 10000 }, lines: [] } }));
    const add = { ...moving, serviceCodes: ["SERVICE_NEDPAKKING", "SERVICE_FLYTTEVASK"] };
    const preview = await (await put({ moving: add, dryRun: true })).json();
    // 5 000 + 4 000 + 4 800 − 1 000 ex. VAT; 6 250 + 5 000 + 6 000 − 1 250 incl.
    expect(preview).toMatchObject({ priceExVat: 12800, previousTotalIncVat: 10000, totalIncVat: 16000 });
    await put({ moving: add, shownTotal: 16000 });
    expect(mocks.orderUpdate.mock.calls[0][0].data).toMatchObject({ priceExVat: 12800 });
  });

  it("confirms the price the customer was shown, like a delivery order", async () => {
    const add = { ...moving, serviceCodes: ["SERVICE_NEDPAKKING", "SERVICE_FLYTTEVASK"] };
    expect((await put({ moving: add })).status).toBe(400);
    const res = await put({ moving: add, shownTotal: 1 });
    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe("PRICE_CHANGED");
  });

  it("within 24h of the job lets the customer add a service", async () => {
    mocks.orderFindFirst.mockResolvedValue(order(afterCutoff));
    const res = await put({ moving: { ...moving, serviceCodes: ["SERVICE_NEDPAKKING", "SERVICE_FLYTTEVASK"] }, shownTotal: 11250 + 6000 });
    expect((await res.json()).ok).toBe(true);
    expect(mocks.transaction).toHaveBeenCalled();
  });

  it("but not move an address, change either end or remove a service", async () => {
    mocks.orderFindFirst.mockResolvedValue(order(afterCutoff));
    const res = await put({ moving: { ...moving, pickupAddress: "Storgata 9, Oslo", serviceCodes: [] } });
    expect(res.status).toBe(403);
    expect((await res.json()).forbidden).toEqual(["addresses", "reconfigure"]);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("never makes a paid order cheaper here", async () => {
    mocks.orderFindFirst.mockResolvedValue(order({ payments: [{ amountChargedCents: 1125000, createdAt: new Date(), orderSnapshot: null }] }));
    const res = await put({ moving: { ...moving, serviceCodes: [] } });
    expect((await res.json()).reason).toBe("WOULD_DECREASE_PRICE");
  });

  it("tells staff and emails the customer what changed", async () => {
    await put({ moving: { ...moving, serviceCodes: ["SERVICE_NEDPAKKING", "SERVICE_FLYTTEVASK"] }, shownTotal: 11250 + 6000 });
    expect(mocks.createOrderNotification).toHaveBeenCalled();
    expect(mocks.sendLifecycleEmails).toHaveBeenCalledWith(expect.objectContaining({ kind: "order_updated" }));
  });

  it("still saves just contact details without re-pricing", async () => {
    await put({ customer: { name: "Kari Nordmann", phone: "+47 12345678", email: "kari@example.no", comments: "" } });
    expect(mocks.getMovingCatalog).not.toHaveBeenCalled();
    expect(mocks.orderUpdate).toHaveBeenCalled();
  });
});

describe("customer order route — a homepage move's staff pricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    mocks.getCustomerSession.mockResolvedValue({ sessionId: "s1", accountId: "acc-1", email: "kari@example.no" });
    mocks.transaction.mockResolvedValue([]);
    mocks.getMovingCatalog.mockResolvedValue({
      priceListId: "pl",
      options: [opt("SIZE_UNDER_40", "Under 40 m²", 500000)],
      services: [opt("SERVICE_NEDPAKKING", "Packing", 400000), opt("SERVICE_FLYTTEVASK", "Move-out cleaning", 480000)],
      floorSurcharge: null,
      carrySurcharges: [],
      distanceRates: { kmFrom21: opt("KM_FROM_21", "Per km", 2890), kmOver100: opt("KM_OVER_100", "Per km", 2890) },
    });
  });

  afterEach(() => vi.useRealTimers());

  const packingKey = "MOVING_ADDITIONAL_SERVICES:SERVICE_NEDPAKKING";
  const withStaffPricing = () =>
    order({
      rabatt: "500",
      leggTil: "100",
      priceExVat: 4600,
      pricingSnapshot: { customer: { totalExVat: 4600, totalIncVat: 5750 }, lines: [], movingNulledLines: { customer: [packingKey], subcontractor: [] } },
    });

  it("gives the page the discount, extra and lines set to 0, so its live price matches", async () => {
    mocks.orderFindFirst.mockResolvedValue(withStaffPricing());
    const json = await (await GET(new Request("http://localhost/api/customer/orders/583920"), params)).json();
    expect(json.pricingContext).toEqual({ rabatt: "500", leggTil: "100", nulledLineKeys: [packingKey], staffLines: [] });
  });

  // Express or a deviation staff added (moving-details): kept as priced.
  const expressItem = {
    cardId: 0,
    productCode: "MOVING_EXPRESS",
    productName: "Express delivery",
    itemType: "product",
    optionCode: "EXPRESS_DELIVERY",
    optionLabel: "Express delivery",
    quantity: 1,
    customerPriceCents: 150000,
    subcontractorPriceCents: 80000,
  };

  it("gives the page the express/deviation lines staff added, so its live price matches", async () => {
    mocks.orderFindFirst.mockResolvedValue(order({ items: [expressItem] }));
    const json = await (await GET(new Request("http://localhost/api/customer/orders/583920"), params)).json();
    expect(json.pricingContext.staffLines).toEqual([
      { key: "MOVING_EXPRESS:EXPRESS_DELIVERY", label: "Express delivery", qty: 1, customerPriceCents: 150000 },
    ]);
  });

  it("keeps an express line staff added when the customer changes the move", async () => {
    mocks.orderFindFirst.mockResolvedValue(order({ items: [expressItem], priceExVat: 10500 }));
    const add = { ...moving, serviceCodes: ["SERVICE_NEDPAKKING", "SERVICE_FLYTTEVASK"] };
    const preview = await (await put({ moving: add, dryRun: true })).json();
    expect(preview.priceExVat).toBe(5000 + 4000 + 4800 + 1500);
    await put({ moving: add, shownTotal: preview.totalIncVat });
    const rows = mocks.itemCreateMany.mock.calls[0][0].data as Record<string, unknown>[];
    expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ productCode: "MOVING_EXPRESS", customerPriceCents: 150000 })]));
  });

  it("keeps a line staff set to 0 when the customer changes the move", async () => {
    mocks.orderFindFirst.mockResolvedValue(withStaffPricing());
    const add = { ...moving, serviceCodes: ["SERVICE_NEDPAKKING", "SERVICE_FLYTTEVASK"] };
    const preview = await (await put({ moving: add, dryRun: true })).json();
    // 5 000 + 0 (packing set to 0) + 4 800 − 500 + 100.
    expect(preview.priceExVat).toBe(9400);
  });
});
