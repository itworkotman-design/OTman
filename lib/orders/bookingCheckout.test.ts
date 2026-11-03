import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderUpdate: vi.fn(),
  orderUpdateMany: vi.fn(),
  createSession: vi.fn(),
  createOrderStatusChangedEvent: vi.fn(),
  cancelledOrderPartnerData: vi.fn(),
  orderFindUnique: vi.fn(),
  createOrderNotification: vi.fn(),
  welcomeWebsiteOrderCustomer: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { order: { update: mocks.orderUpdate, updateMany: mocks.orderUpdateMany, findUnique: mocks.orderFindUnique } },
}));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: mocks.createOrderNotification }));
vi.mock("@/lib/customerAccounts/welcomeWebsiteOrderCustomer", () => ({
  welcomeWebsiteOrderCustomer: mocks.welcomeWebsiteOrderCustomer,
}));
vi.mock("@/lib/stripe/stripeClient", () => ({
  getStripeClient: () => ({ checkout: { sessions: { create: mocks.createSession } } }),
  getOrderActionBaseUrl: () => "https://otman.no",
}));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderStatusChangedEvent: mocks.createOrderStatusChangedEvent }));
vi.mock("@/lib/orders/cancelledOrderPartner", () => ({ cancelledOrderPartnerData: mocks.cancelledOrderPartnerData }));

import { isAwaitingBookingPayment } from "./bookingPayment";
import { cancelUnpaidBookingOrder, startBookingCheckout, welcomePaidBookingOrder } from "./bookingCheckout";

const order = {
  id: "order1",
  companyId: "c1",
  displayId: 20012,
  orderNumber: "G8SMMP58",
  status: "processing",
  email: "customer@example.com",
  actionToken: "a".repeat(32),
  productsSummary: "Vaskemaskin",
  priceExVat: 1000,
  rabatt: null,
  leggTil: null,
  pricingSnapshot: { customer: { totalExVat: 1000, totalIncVat: 1250 } },
  subcontractorMembershipId: null,
  subcontractor: null,
};

describe("isAwaitingBookingPayment", () => {
  it("is a processing order whose booking payment hasn't come in", () => {
    expect(isAwaitingBookingPayment({ status: "processing", paymentStatus: "pending", payments: [] })).toBe(true);
  });

  it("is not a paid order, an order without a payment status, or one already charged through Stripe", () => {
    expect(isAwaitingBookingPayment({ status: "processing", paymentStatus: "paid", payments: [] })).toBe(false);
    expect(isAwaitingBookingPayment({ status: "processing", paymentStatus: null, payments: [] })).toBe(false);
    expect(isAwaitingBookingPayment({ status: "approved", paymentStatus: "pending", payments: [] })).toBe(false);
    expect(isAwaitingBookingPayment({ status: "cancelled", paymentStatus: "pending", payments: [] })).toBe(false);
    expect(
      isAwaitingBookingPayment({ status: "processing", paymentStatus: "pending", payments: [{ amountChargedCents: 1 }] }),
    ).toBe(false);
  });
});

describe("startBookingCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSession.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/cs_1" });
    mocks.orderUpdate.mockResolvedValue({});
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 });
    mocks.cancelledOrderPartnerData.mockResolvedValue({});
  });

  it("opens a short-lived booking session for what the customer was shown, and remembers it on the order", async () => {
    const result = await startBookingCheckout(order);

    expect(result).toEqual({ ok: true, url: "https://checkout.stripe.com/cs_1" });
    const args = mocks.createSession.mock.calls[0]![0];
    expect(args.line_items[0].price_data.unit_amount).toBe(125000);
    expect(args.metadata.chargeKind).toBe("booking");
    expect(args.expires_at).toBeTypeOf("number");
    expect(mocks.orderUpdate).toHaveBeenCalledWith({ where: { id: "order1" }, data: { stripeCheckoutSessionId: "cs_1" } });
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
  });

  it("cancels the order when Stripe can't open a session, so no unpaid order is left behind", async () => {
    mocks.createSession.mockRejectedValue(new Error("Stripe down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await startBookingCheckout(order);

    expect(result).toEqual({ ok: false });
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "order1", paymentStatus: "pending" }),
        data: expect.objectContaining({ status: "cancelled" }),
      }),
    );
    expect(mocks.createOrderStatusChangedEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "order1", fromStatus: "processing", toStatus: "cancelled" }),
    );
  });
});

describe("cancelUnpaidBookingOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cancelledOrderPartnerData.mockResolvedValue({ subcontractor: "Cancelled" });
  });

  it("cancels only while the order is still unpaid on that session, and logs why", async () => {
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 });

    const cancelled = await cancelUnpaidBookingOrder(order, { sessionId: "cs_1", note: "Checkout expired." });

    expect(cancelled).toBe(true);
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: { id: "order1", status: "processing", paymentStatus: "pending", stripeCheckoutSessionId: "cs_1" },
      data: expect.objectContaining({ status: "cancelled", subcontractor: "Cancelled", statusNotes: "Checkout expired." }),
    });
    expect(mocks.createOrderStatusChangedEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toStatus: "cancelled", note: "Checkout expired." }),
    );
  });

  it("does nothing when the order was paid (or moved on) in the meantime", async () => {
    mocks.orderUpdateMany.mockResolvedValue({ count: 0 });

    const cancelled = await cancelUnpaidBookingOrder(order, { sessionId: "cs_1", note: "Checkout expired." });

    expect(cancelled).toBe(false);
    expect(mocks.createOrderStatusChangedEvent).not.toHaveBeenCalled();
  });
});

describe("welcomePaidBookingOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tells staff about the paid order and welcomes the customer (login + order-received email)", async () => {
    const row = { ...order, customerName: "Ralfs", phone: "93004023", paymentStatus: "paid" };
    mocks.orderFindUnique.mockResolvedValue(row);

    await welcomePaidBookingOrder("order1");

    expect(mocks.createOrderNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "order1", companyId: "c1", type: "MANUAL_REVIEW", title: "WEBSITE ORDER - PAID" }),
    );
    expect(mocks.welcomeWebsiteOrderCustomer).toHaveBeenCalledWith(row);
  });

  it("does nothing for an order that no longer exists", async () => {
    mocks.orderFindUnique.mockResolvedValue(null);
    await welcomePaidBookingOrder("gone");
    expect(mocks.welcomeWebsiteOrderCustomer).not.toHaveBeenCalled();
  });
});
