import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pendingCreate: vi.fn(),
  pendingUpdate: vi.fn(),
  pendingUpdateMany: vi.fn(),
  pendingFindUnique: vi.fn(),
  orderFindFirst: vi.fn(),
  checkoutCreate: vi.fn(),
  editCustomerOrder: vi.fn(),
  recordOrderPayment: vi.fn(),
  refundOrderPayments: vi.fn(),
  createOrderNotification: vi.fn(),
  createOrderActionEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    orderPendingChange: {
      create: mocks.pendingCreate,
      update: mocks.pendingUpdate,
      updateMany: mocks.pendingUpdateMany,
      findUnique: mocks.pendingFindUnique,
    },
    order: { findFirst: mocks.orderFindFirst },
  },
}));
vi.mock("@/lib/stripe/stripeClient", () => ({
  getStripeClient: () => ({ checkout: { sessions: { create: mocks.checkoutCreate } }, refunds: {} }),
  getOrderActionBaseUrl: () => "https://otman.no",
}));
vi.mock("@/lib/customerAccounts/customerOrderEdit", () => ({ editCustomerOrder: mocks.editCustomerOrder }));
vi.mock("@/lib/orders/orderPayments", async () => {
  const actual = await vi.importActual<typeof import("@/lib/orders/orderPayments")>("@/lib/orders/orderPayments");
  return { ...actual, recordOrderPayment: mocks.recordOrderPayment };
});
vi.mock("@/lib/orders/orderRefunds", () => ({ refundOrderPayments: mocks.refundOrderPayments }));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: mocks.createOrderNotification }));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderActionEvent: mocks.createOrderActionEvent }));

import { applyPaidChange, startPaidChangeCheckout } from "./customerOrderPaidChange";

const order = {
  id: "o1",
  companyId: "c1",
  displayId: 20500,
  orderNumber: "AB12CD",
  email: "kari@example.no",
  productsSummary: "Vaskemaskin",
  priceExVat: 1000,
  rabatt: null,
  leggTil: null,
  pricingSnapshot: null,
  websiteOrderKind: "WHITE_GOODS",
  websiteBookingDetails: null,
  pickupAddress: null,
  deliveryAddress: null,
  extraPickupAddress: [],
  deliveryDate: "2026-10-20",
  timeWindow: null,
  drivingDistance: null,
};

const pending = {
  id: "pc1",
  orderId: "o1",
  companyId: "c1",
  customerAccountId: "acc1",
  body: { productCards: [{ cardId: 0 }], shownTotal: 1500 },
  amountDueCents: 25000,
  expectedTotalIncVat: 1500,
  status: "PENDING",
};

const session = {
  id: "cs_1",
  payment_intent: "pi_1",
  amount_total: 25000,
  metadata: { orderId: "o1", pendingChangeId: "pc1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pendingCreate.mockResolvedValue({ id: "pc1" });
  mocks.pendingUpdate.mockResolvedValue({});
  mocks.pendingUpdateMany.mockResolvedValue({ count: 1 });
  mocks.pendingFindUnique.mockResolvedValue(pending);
  mocks.orderFindFirst.mockResolvedValue(order);
  mocks.checkoutCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.test/cs_1" });
  mocks.editCustomerOrder.mockResolvedValue({ status: 200, json: { ok: true, changed: true } });
  mocks.recordOrderPayment.mockResolvedValue({ id: "pay1" });
  mocks.refundOrderPayments.mockResolvedValue({ ok: true, refundedCents: 25000 });
});

describe("startPaidChangeCheckout", () => {
  it("holds the change and opens a Stripe checkout for just the difference, back to My order", async () => {
    const result = await startPaidChangeCheckout({
      order: order as never,
      accountId: "acc1",
      body: { productCards: [{ cardId: 0 }], shownTotal: 1500, dryRun: false },
      amountDueCents: 25000,
      totalIncVat: 1500,
    });

    expect(result).toEqual({ url: "https://checkout.stripe.test/cs_1" });
    expect(mocks.pendingCreate).toHaveBeenCalledWith({
      data: {
        orderId: "o1",
        companyId: "c1",
        customerAccountId: "acc1",
        body: { productCards: [{ cardId: 0 }], shownTotal: 1500 },
        amountDueCents: 25000,
        expectedTotalIncVat: 1500,
      },
      select: { id: true },
    });
    const params = mocks.checkoutCreate.mock.calls[0][0];
    expect(params).toMatchObject({
      mode: "payment",
      customer_email: "kari@example.no",
      line_items: [{ quantity: 1, price_data: { currency: "nok", unit_amount: 25000 } }],
      success_url: "https://otman.no/min-bestilling/AB12CD?endring=betalt",
      cancel_url: "https://otman.no/min-bestilling/AB12CD?endring=avbrutt",
      metadata: { orderId: "o1", pendingChangeId: "pc1", chargeKind: "change" },
    });
    expect(mocks.pendingUpdate).toHaveBeenCalledWith({ where: { id: "pc1" }, data: { stripeCheckoutSessionId: "cs_1" } });
  });
});

describe("applyPaidChange", () => {
  it("applies the paid change (mode paid, at the price it was paid for), then records the payment against the changed order", async () => {
    await applyPaidChange(session as never);

    expect(mocks.pendingUpdateMany).toHaveBeenCalledWith({ where: { id: "pc1", status: "PENDING" }, data: { status: "APPLYING" } });
    expect(mocks.editCustomerOrder).toHaveBeenCalledWith(order, { productCards: [{ cardId: 0 }], shownTotal: 1500 }, expect.objectContaining({ mode: "paid" }));
    expect(mocks.recordOrderPayment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "o1", stripeCheckoutSessionId: "cs_1", stripePaymentIntentId: "pi_1", amountChargedCents: 25000 }),
    );
    expect(mocks.editCustomerOrder.mock.invocationCallOrder[0]).toBeLessThan(mocks.recordOrderPayment.mock.invocationCallOrder[0]);
    expect(mocks.pendingUpdate).toHaveBeenCalledWith({
      where: { id: "pc1" },
      data: { status: "APPLIED", resolvedAt: expect.any(Date) },
    });
    expect(mocks.refundOrderPayments).not.toHaveBeenCalled();
  });

  it("does nothing more when Stripe redelivers the event (already claimed) — only makes sure the payment is recorded", async () => {
    mocks.pendingUpdateMany.mockResolvedValue({ count: 0 });

    await applyPaidChange(session as never);

    expect(mocks.editCustomerOrder).not.toHaveBeenCalled();
    expect(mocks.recordOrderPayment).toHaveBeenCalled();
    expect(mocks.refundOrderPayments).not.toHaveBeenCalled();
  });

  it("refunds the payment and alerts staff when the change can't be applied any more", async () => {
    mocks.editCustomerOrder.mockResolvedValue({ status: 403, json: { ok: false, reason: "EDIT_NOT_ALLOWED" } });

    await applyPaidChange(session as never);

    expect(mocks.recordOrderPayment).toHaveBeenCalled();
    expect(mocks.refundOrderPayments).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      orderId: "o1",
      companyId: "c1",
      amountCents: 25000,
      reason: "Paid change could not be applied: EDIT_NOT_ALLOWED",
    });
    expect(mocks.pendingUpdate).toHaveBeenCalledWith({
      where: { id: "pc1" },
      data: { status: "FAILED", failureReason: "EDIT_NOT_ALLOWED", resolvedAt: expect.any(Date) },
    });
    const alert = mocks.createOrderNotification.mock.calls[0][1];
    expect(alert.title).toContain("couldn't be applied");
    expect(alert.message).toContain("refunded automatically");
  });

  it("…a price that moved since checkout counts too", async () => {
    mocks.editCustomerOrder.mockResolvedValue({ status: 409, json: { ok: false, reason: "PRICE_CHANGED" } });

    await applyPaidChange(session as never);

    expect(mocks.refundOrderPayments).toHaveBeenCalled();
  });

  it("tells staff to refund by hand when the automatic refund fails too", async () => {
    mocks.editCustomerOrder.mockResolvedValue({ status: 403, json: { ok: false, reason: "EDIT_NOT_ALLOWED" } });
    mocks.refundOrderPayments.mockResolvedValue({ ok: false, reason: "STRIPE_ERROR", refundedCents: 0 });

    await applyPaidChange(session as never);

    expect(mocks.createOrderNotification.mock.calls[0][1].message).toContain("refund it in Stripe");
  });

  it("refunds when the order is gone", async () => {
    mocks.orderFindFirst.mockResolvedValue(null);

    await applyPaidChange(session as never);

    expect(mocks.editCustomerOrder).not.toHaveBeenCalled();
    expect(mocks.pendingUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }));
  });
});
