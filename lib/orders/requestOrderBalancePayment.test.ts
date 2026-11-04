import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindFirst: vi.fn(),
  orderUpdate: vi.fn(),
  createOrderActionEvent: vi.fn(),
  sendLifecycleEmailsForOrders: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { order: { findFirst: mocks.orderFindFirst, update: mocks.orderUpdate } } }));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderActionEvent: mocks.createOrderActionEvent }));
vi.mock("@/lib/orders/sendCustomerLifecycleEmail", () => ({ sendLifecycleEmailsForOrders: mocks.sendLifecycleEmailsForOrders }));
vi.mock("@/lib/orders/orderActionToken", () => ({ createOrderActionToken: () => "new-token" }));

import { requestOrderBalancePayment } from "./requestOrderBalancePayment";

// Paid 1 250 kr incl. VAT at booking; the order now costs 1 500 kr incl. VAT.
const order = (over: Record<string, unknown> = {}) => ({
  id: "o1",
  companyId: "c1",
  displayId: 1042,
  orderNumber: "583920",
  status: "processing",
  isWebsiteOrder: true,
  customerName: "Kari",
  customerLabel: null,
  statusNotes: null,
  actionToken: "tok",
  email: "kari@example.no",
  emailThreadToken: null,
  priceExVat: 1200,
  rabatt: null,
  leggTil: null,
  pricingSnapshot: { customer: { totalExVat: 1200, totalIncVat: 1500 }, lines: [] },
  websiteOrderKind: "WHITE_GOODS",
  websiteBookingDetails: null,
  pickupAddress: null,
  deliveryAddress: null,
  extraPickupAddress: [],
  deliveryDate: null,
  timeWindow: null,
  drivingDistance: null,
  payments: [{ amountChargedCents: 125000, createdAt: new Date("2026-11-01T10:00:00Z"), orderSnapshot: null, refunds: [] }],
  ...over,
});

const actor = { source: "USER", name: "Ola" } as never;
const request = (expectedAmountCents = 25000) => requestOrderBalancePayment({ orderId: "o1", companyId: "c1", actor, expectedAmountCents });

describe("requestOrderBalancePayment — Send payment request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendLifecycleEmailsForOrders.mockResolvedValue({ sentCount: 1, failedOrderIds: [] });
  });

  it("emails the customer the balance-due payment link for exactly what's owed, and logs it", async () => {
    mocks.orderFindFirst.mockResolvedValue(order());

    expect(await request()).toEqual({ ok: true, amountCents: 25000 });

    expect(mocks.sendLifecycleEmailsForOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "balance_due",
        orders: [
          expect.objectContaining({
            id: "o1",
            actionToken: "tok",
            balanceDue: expect.objectContaining({ paidIncVatNok: 1250, totalIncVatNok: 1500, amountDueIncVatNok: 250 }),
          }),
        ],
      }),
    );
    expect(mocks.createOrderActionEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ title: "Sent payment request for 250 kr" }));
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
  });

  it("mints the pay link's token when the order has none yet", async () => {
    mocks.orderFindFirst.mockResolvedValue(order({ actionToken: null }));

    await request();

    expect(mocks.orderUpdate).toHaveBeenCalledWith({ where: { id: "o1" }, data: { actionToken: "new-token" } });
    expect(mocks.sendLifecycleEmailsForOrders.mock.calls[0]![0].orders[0].actionToken).toBe("new-token");
  });

  it("refuses when nothing more is owed", async () => {
    mocks.orderFindFirst.mockResolvedValue(order({ priceExVat: 1000, pricingSnapshot: { customer: { totalExVat: 1000, totalIncVat: 1250 }, lines: [] } }));
    expect(await request()).toMatchObject({ ok: false, reason: "NOTHING_DUE", status: 409 });
    expect(mocks.sendLifecycleEmailsForOrders).not.toHaveBeenCalled();
  });

  it("refuses with the current amount when the order changed since staff saw it", async () => {
    mocks.orderFindFirst.mockResolvedValue(order());
    expect(await request(10000)).toEqual({ ok: false, reason: "AMOUNT_CHANGED", status: 409, amountCents: 25000 });
    expect(mocks.sendLifecycleEmailsForOrders).not.toHaveBeenCalled();
  });

  it("refuses without a customer email", async () => {
    mocks.orderFindFirst.mockResolvedValue(order({ email: " " }));
    expect(await request()).toMatchObject({ ok: false, reason: "MISSING_CUSTOMER_EMAIL" });
  });

  it("404s for an order that isn't this company's website order", async () => {
    mocks.orderFindFirst.mockResolvedValue(null);
    expect(await request()).toMatchObject({ ok: false, reason: "NOT_FOUND", status: 404 });
  });

  it("reports a failed email", async () => {
    mocks.orderFindFirst.mockResolvedValue(order());
    mocks.sendLifecycleEmailsForOrders.mockResolvedValue({ sentCount: 0, failedOrderIds: ["o1"] });
    expect(await request()).toMatchObject({ ok: false, reason: "EMAIL_FAILED", status: 502 });
  });
});
