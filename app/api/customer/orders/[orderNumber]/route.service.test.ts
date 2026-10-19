import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// "My order" for a homepage service request: the customer sees and changes
// the service, the job and the address until 24h before the job; after that
// nothing (not even the job or contact details) can be changed. Staff's quote
// (the price) is never the customer's to change.

const mocks = vi.hoisted(() => ({
  getCustomerSession: vi.fn(),
  orderFindFirst: vi.fn(),
  orderUpdate: vi.fn((arg) => ({ op: "order.update", arg })),
  itemDeleteMany: vi.fn((arg) => ({ op: "items.deleteMany", arg })),
  itemCreateMany: vi.fn((arg) => ({ op: "items.createMany", arg })),
  transaction: vi.fn(),
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
vi.mock("@/lib/orders/orderEvents", () => ({
  createOrderUpdatedEvent: mocks.createOrderUpdatedEvent,
  createOrderStatusChangedEvent: mocks.createOrderStatusChangedEvent,
}));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: mocks.createOrderNotification }));
vi.mock("@/lib/orders/sendCustomerLifecycleEmail", () => ({ sendLifecycleEmailsForOrders: mocks.sendLifecycleEmails }));

import { GET, PUT } from "./route";

const NOW = new Date("2026-10-05T10:00:00Z");
const electrician = { serviceCode: "option-1", customService: "", jobDescription: "Install lights." };
const carpenter = { serviceCode: "option-2", customService: "", jobDescription: "Fix the door." };
const service = { address: "Storgata 1, Oslo", services: [electrician] };
const quoteItem = {
  cardId: 0,
  itemType: "product",
  productId: null,
  productCode: "SERVICE_QUOTE",
  productName: "Service",
  deliveryType: null,
  optionCode: "QUOTE:option-1",
  optionLabel: "Electrician",
  quantity: 1,
  rawData: null,
  optionId: null,
  customerPriceCents: 400000,
  subcontractorPriceCents: 250000,
};

// Quoted at 4 000 ex. VAT; the customer pays 5 000.
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
    customerComments: "test",
    description: "Service: Electrician\n\nCustomer type: Private\n\nInstall lights.",
    priceExVat: 4000,
    priceSubcontractor: 2500,
    rabatt: null,
    leggTil: null,
    subcontractorMinus: null,
    subcontractorPlus: null,
    pricingSnapshot: { customer: { totalExVat: 4000, totalIncVat: 5000 }, lines: [] },
    pickupAddress: null,
    deliveryAddress: service.address,
    extraPickupAddress: [],
    deliveryDate: "2026-10-10",
    timeWindow: "10:00-16:00",
    drivingDistance: null,
    productsSummary: "Service request (Electrician)",
    gsmSentAt: null,
    websiteOrderKind: "SERVICE",
    websiteBookingDetails: { version: 2, customerType: "private", services: [electrician] },
    productCardsSnapshot: null,
    payments: [],
    events: [],
    items: [quoteItem],
    ...overrides,
  };
}

// Job tomorrow 10:00 Oslo: the cutoff (today 08:00Z) has passed.
const afterCutoff = { deliveryDate: "2026-10-06", timeWindow: "10:00-16:00" };

const params = { params: Promise.resolve({ orderNumber: "583920" }) };
function put(body: unknown) {
  return PUT(new Request("http://localhost/api/customer/orders/583920", { method: "PUT", body: JSON.stringify(body) }), params);
}

type Write = { op: string; arg: { data: Record<string, unknown> & { optionLabel?: string }[] } };
function transactionWrites() {
  const ops = mocks.transaction.mock.calls.at(-1)![0] as Write[];
  return Object.fromEntries(ops.map((o) => [o.op, o.arg]));
}

describe("customer order route — a homepage service request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    mocks.getCustomerSession.mockResolvedValue({ sessionId: "s1", accountId: "acc-1", email: "kari@example.no" });
    mocks.orderFindFirst.mockResolvedValue(order());
    mocks.transaction.mockResolvedValue([]);
    mocks.sendLifecycleEmails.mockResolvedValue({ sentCount: 1, failedOrderIds: [] });
  });

  afterEach(() => vi.useRealTimers());

  it("gives the page the service to show and edit — never the partner price", async () => {
    const json = await (await GET(new Request("http://localhost/api/customer/orders/583920"), params)).json();
    expect(json.details).toMatchObject({ kind: "service", service, customerType: "private" });
    expect(JSON.stringify(json.details)).not.toContain("2500");
  });

  it("saves a new job description and address, keeping the price and the quote", async () => {
    const changed = { address: "Kirkegata 5, Oslo", services: [{ ...electrician, jobDescription: "Install four lights." }] };
    const json = await (await put({ service: changed })).json();
    expect(json).toMatchObject({ ok: true, changed: true, priceExVat: 4000, totalIncVat: 5000 });

    const writes = transactionWrites();
    expect(writes["items.createMany"].data).toEqual([
      expect.objectContaining({ optionCode: "QUOTE:option-1", customerPriceCents: 400000, subcontractorPriceCents: 250000 }),
    ]);
    expect(writes["order.update"].data).toMatchObject({
      deliveryAddress: "Kirkegata 5, Oslo",
      description: "Customer type: Private\n\nService: Electrician\nInstall four lights.",
      websiteBookingDetails: expect.objectContaining({ services: [{ ...electrician, jobDescription: "Install four lights." }] }),
      priceExVat: 4000,
    });
    // Staff are told what changed.
    expect(mocks.createOrderNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "MANUAL_REVIEW", message: expect.stringContaining("Electrician — what needs doing: Install lights. → Install four lights.") }),
    );
  });

  it("adds a service — unpriced until staff quote it, so the price stays", async () => {
    const json = await (await put({ service: { ...service, services: [electrician, carpenter] } })).json();
    expect(json).toMatchObject({ ok: true, priceExVat: 4000 });
    const writes = transactionWrites();
    expect(writes["items.createMany"].data).toHaveLength(1);
    expect(writes["order.update"].data).toMatchObject({ productsSummary: "Service request (Electrician + Carpenter)" });
    expect(mocks.createOrderNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ message: expect.stringContaining("Service added: Carpenter") }),
    );
  });

  it("removes a quoted service at the price shown — its line goes, the total drops", async () => {
    const carpenterLine = { ...quoteItem, optionCode: "QUOTE:option-2", optionLabel: "Carpenter", customerPriceCents: 100000, subcontractorPriceCents: 60000 };
    mocks.orderFindFirst.mockResolvedValue(
      order({
        websiteBookingDetails: { version: 2, customerType: "private", services: [electrician, carpenter] },
        items: [quoteItem, carpenterLine],
        priceExVat: 5000,
        pricingSnapshot: { customer: { totalExVat: 5000, totalIncVat: 6250 }, lines: [] },
      }),
    );
    const preview = await (await put({ service, dryRun: true })).json();
    expect(preview).toMatchObject({ previousTotalIncVat: 6250, totalIncVat: 5000 });
    expect((await put({ service })).status).toBe(400);
    const json = await (await put({ service, shownTotal: 5000 })).json();
    expect(json).toMatchObject({ ok: true, priceExVat: 4000 });
    expect(transactionWrites()["items.createMany"].data).toEqual([expect.objectContaining({ optionCode: "QUOTE:option-1" })]);
  });

  it("won't make a paid order cheaper", async () => {
    const carpenterLine = { ...quoteItem, optionCode: "QUOTE:option-2", customerPriceCents: 100000 };
    mocks.orderFindFirst.mockResolvedValue(
      order({
        websiteBookingDetails: { version: 2, customerType: "private", services: [electrician, carpenter] },
        items: [quoteItem, carpenterLine],
        priceExVat: 5000,
        payments: [{ amountChargedCents: 625000, createdAt: new Date(), orderSnapshot: null }],
      }),
    );
    const res = await put({ service, shownTotal: 5000 });
    expect(res.status).toBe(422);
    expect((await res.json()).reason).toBe("WOULD_DECREASE_PRICE");
  });

  it("previews a service change at the same price (dryRun)", async () => {
    const json = await (await put({ service: { ...service, services: [{ ...electrician, jobDescription: "More lights." }] }, dryRun: true })).json();
    expect(json).toMatchObject({ ok: true, dryRun: true, previousTotalIncVat: 5000, totalIncVat: 5000 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid service", async () => {
    const res = await put({ service: { ...service, services: [{ ...electrician, jobDescription: "" }] } });
    expect(res.status).toBe(422);
    expect((await res.json()).reason).toBe("INVALID_DETAILS");
  });

  it("within 24h refuses every change — address, service, job description, contact details", async () => {
    mocks.orderFindFirst.mockResolvedValue(order(afterCutoff));
    expect((await put({ service: { ...service, address: "Kirkegata 5, Oslo" } })).status).toBe(403);
    expect((await put({ service: { ...service, services: [electrician, carpenter] } })).status).toBe(403);
    expect((await put({ service: { ...service, services: [{ ...electrician, jobDescription: "Install four lights." }] } })).status).toBe(403);
    expect((await put({ customer: { name: "Kari", phone: "+47 12345678", email: "kari@example.no", comments: "new note" } })).status).toBe(403);
    expect((await put({ customer: { name: "Kari Nordmann", phone: "+47 12345678", email: "kari@example.no", comments: "test" } })).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
  });

  it("has nothing to save when the service comes back unchanged", async () => {
    const json = await (await put({ service })).json();
    expect(json).toMatchObject({ ok: true, changed: false });
  });
});
