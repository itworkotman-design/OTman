import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindUniqueMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  orderPaymentFindManyMock: vi.fn(),
  recordOrderPaymentMock: vi.fn(),
  createOrderStatusChangedEventMock: vi.fn(),
  createOrderActionEventMock: vi.fn(),
  constructEventMock: vi.fn(),
  sendLifecycleEmailsForOrdersMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findUnique: mocks.orderFindUniqueMock, update: mocks.orderUpdateMock },
    orderPayment: { findMany: mocks.orderPaymentFindManyMock },
  },
}));

vi.mock("@/lib/orders/orderPayments", () => ({
  recordOrderPayment: mocks.recordOrderPaymentMock,
  sumOrderPayments: (payments: { amountChargedCents: number }[]) =>
    payments.reduce((sum, p) => sum + p.amountChargedCents, 0),
}));

vi.mock("@/lib/orders/orderEvents", () => ({
  createOrderStatusChangedEvent: mocks.createOrderStatusChangedEventMock,
  createOrderActionEvent: mocks.createOrderActionEventMock,
}));

vi.mock("@/lib/orders/sendCustomerLifecycleEmail", () => ({
  sendLifecycleEmailsForOrders: mocks.sendLifecycleEmailsForOrdersMock,
}));

vi.mock("@/lib/stripe/stripeClient", () => ({
  getStripeClient: () => ({ webhooks: { constructEvent: mocks.constructEventMock } }),
}));

import { POST } from "./route";

function webhookRequest(event: unknown) {
  mocks.constructEventMock.mockReturnValue(event);
  return new Request("http://localhost/api/integrations/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig" },
    body: JSON.stringify(event),
  });
}

function checkoutSessionCompletedEvent(session: Record<string, unknown>) {
  return {
    type: "checkout.session.completed",
    data: { object: { id: "cs_test", amount_total: 500000, payment_intent: "pi_test", metadata: { orderId: "order1" }, ...session } },
  };
}

describe("POST /api/integrations/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mocks.orderUpdateMock.mockResolvedValue({});
    mocks.createOrderStatusChangedEventMock.mockResolvedValue(undefined);
    mocks.createOrderActionEventMock.mockResolvedValue(undefined);
    mocks.sendLifecycleEmailsForOrdersMock.mockResolvedValue({ sentCount: 1, failedOrderIds: [] });
  });

  it("ignores an event with no orderId in metadata", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue(null);
    const res = await POST(webhookRequest(checkoutSessionCompletedEvent({ metadata: {} })));

    expect(res.status).toBe(200);
    expect(mocks.recordOrderPaymentMock).not.toHaveBeenCalled();
  });

  it("ignores an event for an order that doesn't exist", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue(null);
    const res = await POST(webhookRequest(checkoutSessionCompletedEvent({})));

    expect(res.status).toBe(200);
    expect(mocks.recordOrderPaymentMock).not.toHaveBeenCalled();
  });

  it("on the first payment: records it, confirms the order, logs a status-changed event, and sends the order-confirmed email", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue({
      id: "order1",
      companyId: "company1",
      status: "approved",
      email: "customer@example.com",
      actionToken: "a".repeat(32),
    });
    mocks.recordOrderPaymentMock.mockResolvedValue({ id: "payment1" });
    mocks.orderPaymentFindManyMock.mockResolvedValue([{ amountChargedCents: 500000 }]);

    const res = await POST(webhookRequest(checkoutSessionCompletedEvent({})));

    expect(res.status).toBe(200);
    expect(mocks.recordOrderPaymentMock).toHaveBeenCalledWith(expect.anything(), {
      orderId: "order1",
      companyId: "company1",
      stripeCheckoutSessionId: "cs_test",
      stripePaymentIntentId: "pi_test",
      amountChargedCents: 500000,
    });
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order1" },
      data: { status: "confirmed", stripePaymentIntentId: "pi_test", stripeAmountChargedCents: 500000 },
    });
    expect(mocks.createOrderStatusChangedEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "order1", fromStatus: "approved", toStatus: "confirmed" }),
    );
    expect(mocks.createOrderActionEventMock).not.toHaveBeenCalled();
    expect(mocks.sendLifecycleEmailsForOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "order_confirmed",
        orders: [expect.objectContaining({ id: "order1" })],
      }),
    );
  });

  it("does not send the order-confirmed email for a top-up payment (only the first payment)", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue({
      id: "order1",
      companyId: "company1",
      status: "confirmed",
      email: "customer@example.com",
      actionToken: "a".repeat(32),
    });
    mocks.recordOrderPaymentMock.mockResolvedValue({ id: "payment2" });
    mocks.orderPaymentFindManyMock.mockResolvedValue([{ amountChargedCents: 500000 }, { amountChargedCents: 300000 }]);

    await POST(webhookRequest(checkoutSessionCompletedEvent({ amount_total: 300000 })));

    expect(mocks.sendLifecycleEmailsForOrdersMock).not.toHaveBeenCalled();
  });

  it("still confirms the order and returns 200 even if sending the confirmation email fails", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue({
      id: "order1",
      companyId: "company1",
      status: "approved",
      email: "customer@example.com",
      actionToken: "a".repeat(32),
    });
    mocks.recordOrderPaymentMock.mockResolvedValue({ id: "payment1" });
    mocks.orderPaymentFindManyMock.mockResolvedValue([{ amountChargedCents: 500000 }]);
    mocks.sendLifecycleEmailsForOrdersMock.mockRejectedValue(new Error("email provider down"));

    const res = await POST(webhookRequest(checkoutSessionCompletedEvent({})));

    expect(res.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "confirmed" }) }),
    );
  });

  it("does nothing further when this exact Stripe session was already recorded (redelivered webhook)", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue({ id: "order1", companyId: "company1", status: "confirmed" });
    mocks.recordOrderPaymentMock.mockResolvedValue(null);

    const res = await POST(webhookRequest(checkoutSessionCompletedEvent({})));

    expect(res.status).toBe(200);
    expect(mocks.orderUpdateMock).not.toHaveBeenCalled();
    expect(mocks.createOrderStatusChangedEventMock).not.toHaveBeenCalled();
    expect(mocks.createOrderActionEventMock).not.toHaveBeenCalled();
  });

  it("on a second (top-up) payment for an already-confirmed order: records it, keeps status confirmed, accumulates the total, and logs an action event instead of a status change", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue({ id: "order1", companyId: "company1", status: "confirmed" });
    mocks.recordOrderPaymentMock.mockResolvedValue({ id: "payment2" });
    // Original 500000 + this new 300000 = 800000 total paid.
    mocks.orderPaymentFindManyMock.mockResolvedValue([{ amountChargedCents: 500000 }, { amountChargedCents: 300000 }]);

    const res = await POST(webhookRequest(checkoutSessionCompletedEvent({ amount_total: 300000 })));

    expect(res.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order1" },
      data: { status: undefined, stripePaymentIntentId: "pi_test", stripeAmountChargedCents: 800000 },
    });
    expect(mocks.createOrderStatusChangedEventMock).not.toHaveBeenCalled();
    expect(mocks.createOrderActionEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "order1", title: expect.stringMatching(/additional payment/i) }),
    );
  });
});
