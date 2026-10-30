import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSession: vi.fn(),
  membershipFindFirst: vi.fn(),
  orderFindFirst: vi.fn(),
  orderUpdate: vi.fn((arg) => ({ op: "order.update", arg })),
  itemDeleteMany: vi.fn((arg) => ({ op: "items.deleteMany", arg })),
  itemCreateMany: vi.fn((arg) => ({ op: "items.createMany", arg })),
  transaction: vi.fn(),
  getMovingCatalog: vi.fn(),
  createOrderUpdatedEvent: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthenticatedSession: mocks.getAuthenticatedSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirst },
    order: { findFirst: mocks.orderFindFirst, update: mocks.orderUpdate },
    orderItem: { deleteMany: mocks.itemDeleteMany, createMany: mocks.itemCreateMany },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderUpdatedEvent: mocks.createOrderUpdatedEvent }));
vi.mock("@/lib/content/getMovingCatalog", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content/getMovingCatalog")>("@/lib/content/getMovingCatalog");
  return { ...actual, getMovingCatalog: mocks.getMovingCatalog };
});

import { PUT } from "./route";

const opt = (code: string, labelEn: string, customerPriceCents: number, subcontractorPriceCents = 0) => ({
  code,
  labelEn,
  labelNo: labelEn,
  customerPriceCents,
  subcontractorPriceCents,
});

const quoteItem = {
  cardId: 0,
  productCode: "SERVICE_QUOTE",
  productName: "Service",
  itemType: "product",
  optionCode: "QUOTE:option-1",
  optionLabel: "Electrician",
  quantity: 1,
  customerPriceCents: 400000,
  subcontractorPriceCents: 250000,
};

function storedOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "o1",
    companyId: "c1",
    status: "processing",
    websiteOrderKind: "SERVICE",
    websiteBookingDetails: {
      version: 2,
      customerType: "private",
      services: [{ serviceCode: "option-1", customService: "", jobDescription: "Install lights." }],
    },
    pickupAddress: null,
    deliveryAddress: "Storgata 1, Oslo",
    extraPickupAddress: [],
    drivingDistance: null,
    deliveryDate: "2026-10-22",
    timeWindow: "08:00-16:00",
    customerName: "Kari",
    phone: "+4712345678",
    email: "kari@example.com",
    customerComments: null,
    description: "Service: Electrician\n\nCustomer type: Private\n\nInstall lights.",
    driver: null,
    secondDriver: null,
    driverInfo: null,
    licensePlate: null,
    deviation: null,
    expressDelivery: false,
    rabatt: null,
    leggTil: null,
    subcontractorMinus: null,
    subcontractorPlus: null,
    priceExVat: 4000,
    priceSubcontractor: 2500,
    pricingSnapshot: { customer: { totalExVat: 4000, totalIncVat: 5000 }, lines: [] },
    productsSummary: "Service request (Electrician)",
    items: [quoteItem],
    payments: [],
    ...overrides,
  };
}

function put(body: unknown) {
  return PUT(new Request("http://localhost/api/orders/o1/service-details", { method: "PUT", body: JSON.stringify(body) }), {
    params: Promise.resolve({ orderId: "o1" }),
  });
}

const electrician = { serviceCode: "option-1", customService: "", jobDescription: "Install lights.", quote: { customer: 4000, partner: 2500 } };
const edit = { address: "Storgata 1, Oslo", services: [electrician] };
// The edit with the electrician quoted differently.
const quoted = (customer: number | null, partner: number | null) => ({ ...edit, services: [{ ...electrician, quote: { customer, partner } }] });

// The writes the last transaction ran, by op.
function transactionWrites() {
  const ops = mocks.transaction.mock.calls.at(-1)![0] as { op: string; arg: Record<string, unknown> }[];
  return Object.fromEntries(ops.map((o) => [o.op, o.arg])) as Record<string, { data: Record<string, unknown> & { productCode: string }[] }>;
}

describe("PUT /api/orders/[orderId]/service-details (admin edit of a homepage service request)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSession.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.membershipFindFirst.mockResolvedValue({ id: "m1", role: "OWNER", appAccess: [], user: { username: "admin", email: "a@x" } });
    mocks.orderFindFirst.mockResolvedValue(storedOrder());
    mocks.transaction.mockResolvedValue([]);
    mocks.getMovingCatalog.mockResolvedValue({
      handlingRates: {
        expressDelivery: opt("EXPRESS_DELIVERY", "Express delivery", 150000, 80000),
        deviations: [opt("WRONGADRESS", "Avvik, bomtur; Feil adresse", 59000, 14900), opt("CUSTOM", "Custom", 0, 0)],
      },
    });
  });

  it("returns 401 without a session", async () => {
    mocks.getAuthenticatedSession.mockResolvedValue(null);
    expect((await put({ edit })).status).toBe(401);
  });

  it("returns 403 for someone who can only view website orders", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ id: "m1", role: "USER", appAccess: [{ module: "WEBSITE_ORDERS", enabled: true, level: "VIEWER" }] });
    expect((await put({ edit })).status).toBe(403);
  });

  it("returns 404 for an order that isn't a service request", async () => {
    mocks.orderFindFirst.mockResolvedValue(storedOrder({ websiteOrderKind: "MOVING" }));
    expect((await put({ edit })).status).toBe(404);
  });

  it("refuses to change a finished order", async () => {
    mocks.orderFindFirst.mockResolvedValue(storedOrder({ status: "completed" }));
    const res = await put({ edit });
    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe("NOT_EDITABLE_STATUS");
  });

  it("rejects an invalid edit with its errors", async () => {
    const res = await put({ edit: { ...edit, address: "" } });
    expect(res.status).toBe(422);
    expect((await res.json()).errors).toHaveProperty("address");
  });

  it("quotes an unpriced request: its line, the total and what's stored", async () => {
    mocks.orderFindFirst.mockResolvedValue(storedOrder({ items: [], priceExVat: 0, priceSubcontractor: 0 }));
    const res = await put({ edit: quoted(3200, 2000) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, previousPriceExVat: 0, priceExVat: 3200 });

    const writes = transactionWrites();
    expect(writes["items.deleteMany"]).toEqual({
      where: { orderId: "o1", productCode: { in: ["SERVICE_QUOTE", "MOVING_EXPRESS", "MOVING_DEVIATION"] } },
    });
    expect(writes["items.createMany"].data).toEqual([
      expect.objectContaining({ orderId: "o1", productCode: "SERVICE_QUOTE", optionLabel: "Electrician", customerPriceCents: 320000, subcontractorPriceCents: 200000 }),
    ]);
    expect(writes["order.update"].data).toMatchObject({ priceExVat: 3200, priceSubcontractor: 2000, productsSummary: "Service request (Electrician)" });
    expect(mocks.createOrderUpdatedEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ changes: expect.arrayContaining([expect.objectContaining({ field: "priceExVat", previousValue: "0", nextValue: "3200" })]) }),
    );
  });

  it("adds a service with its own quote: one line per service, both in the summary", async () => {
    const painter = { serviceCode: "custom", customService: "Painter", jobDescription: "Paint the hall.", quote: { customer: 1500, partner: 1000 } };
    const res = await put({ edit: { ...edit, services: [electrician, painter] } });
    expect((await res.json()).priceExVat).toBe(5500);
    const writes = transactionWrites();
    expect(writes["items.createMany"].data).toEqual([
      expect.objectContaining({ optionCode: "QUOTE:option-1", optionLabel: "Electrician", customerPriceCents: 400000 }),
      expect.objectContaining({ optionCode: "QUOTE:custom", optionLabel: "Custom service — Painter", customerPriceCents: 150000 }),
    ]);
    expect(writes["order.update"].data).toMatchObject({
      productsSummary: "Service request (Electrician + Custom service — Painter)",
      description: "Customer type: Private\n\nService: Electrician\nInstall lights.\n\nService: Custom service — Painter\nPaint the hall.",
      websiteBookingDetails: expect.objectContaining({
        services: [
          { serviceCode: "option-1", customService: "", jobDescription: "Install lights." },
          { serviceCode: "custom", customService: "Painter", jobDescription: "Paint the hall." },
        ],
      }),
    });
  });

  it("keeps express/deviation lines staff already added when the quote changes", async () => {
    const express = { ...quoteItem, productCode: "MOVING_EXPRESS", productName: "Express delivery", optionCode: "EXPRESS_DELIVERY", optionLabel: "Express delivery", customerPriceCents: 150000, subcontractorPriceCents: 80000 };
    mocks.orderFindFirst.mockResolvedValue(storedOrder({ items: [quoteItem, express], expressDelivery: true, priceExVat: 5500 }));
    const res = await put({ edit: quoted(5000, 3000) });
    expect((await res.json()).priceExVat).toBe(6500);
    expect(transactionWrites()["items.createMany"].data.map((r: { productCode: string }) => r.productCode)).toEqual(["SERVICE_QUOTE", "MOVING_EXPRESS"]);
  });

  it("prices express from the price list settings when Handle order turns it on", async () => {
    const res = await put({ handling: { expressDelivery: true } });
    expect((await res.json()).priceExVat).toBe(5500);
    const writes = transactionWrites();
    expect(writes["items.createMany"].data.map((r: { productCode: string }) => r.productCode)).toEqual(["SERVICE_QUOTE", "MOVING_EXPRESS"]);
    expect(writes["order.update"].data).toMatchObject({ expressDelivery: true, priceExVat: 5500 });
  });

  it("prices a deviation from the price list settings", async () => {
    const res = await put({ handling: { deviation: "Avvik, bomtur; Feil adresse" } });
    expect((await res.json()).priceExVat).toBe(4590);
  });

  it("re-prices with the calculator's discount and partner minus without touching the lines", async () => {
    const res = await put({ handling: { rabatt: "400", subcontractorMinus: "500" } });
    expect((await res.json()).priceExVat).toBe(3600);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rabatt: "400", subcontractorMinus: "500", priceExVat: 3600, priceSubcontractor: 2000 }) }),
    );
  });

  it("prices with the calculator's adjustment lines and stores them on the pricing snapshot", async () => {
    const lines = [
      { id: "d1", kind: "discount", description: "First-time customer", amount: 250 },
      { id: "d2", kind: "discount", description: "", amount: 150 },
      { id: "m1", kind: "subcontractorMinus", description: "", amount: 500 },
    ];
    const res = await put({ adjustmentLines: lines });
    expect((await res.json()).priceExVat).toBe(3600);
    const data = mocks.orderUpdate.mock.calls[0][0].data;
    expect(data).toMatchObject({ rabatt: "400", subcontractorMinus: "500", priceSubcontractor: 2000 });
    expect(data.pricingSnapshot).toMatchObject({ adjustmentLines: lines });
  });

  it("sets the quote line to 0 from the calculator", async () => {
    const res = await put({ nulledLines: { cards: { 0: { customer: ["SERVICE_QUOTE:QUOTE:option-1"], subcontractor: [] } }, orderExtras: { customer: [], subcontractor: [] } } });
    expect((await res.json()).priceExVat).toBe(0);
  });

  it("saves the contact details, schedule and customer type", async () => {
    await put({
      customer: { name: "Ola", phone: "+4799999999", email: "ola@example.com", comments: "Ring first" },
      preferredDate: "2026-10-30",
      timeWindow: "10:00-14:00",
      customerType: "business",
    });
    expect(mocks.orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerName: "Ola",
          customerComments: "Ring first",
          deliveryDate: "2026-10-30",
          timeWindow: "10:00-14:00",
          websiteBookingDetails: expect.objectContaining({ customerType: "business" }),
        }),
      }),
    );
  });

  it("previews without saving: the price, what was paid, and the calculator", async () => {
    const res = await put({ edit: quoted(5000, 3000), dryRun: true });
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, dryRun: true, previousPriceExVat: 4000, priceExVat: 5000 });
    expect(json.calculator.products[0]).toMatchObject({ name: "Service" });
    expect(json.calculator.customer.total).toBe(5000);
    expect(json.comparison).toBeDefined();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
  });
});
