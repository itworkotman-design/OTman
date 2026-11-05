import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindFirst: vi.fn(),
  orderUpdate: vi.fn(),
  refundOrderPayments: vi.fn(),
  sendCreditNotes: vi.fn(),
  createOrderActionEvent: vi.fn(),
  sendLifecycleEmailsForOrders: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { order: { findFirst: mocks.orderFindFirst, update: mocks.orderUpdate } } }));
vi.mock("@/lib/stripe/stripeClient", () => ({ getStripeClient: () => ({}) }));
vi.mock("@/lib/orders/orderRefunds", () => ({ refundOrderPayments: mocks.refundOrderPayments }));
vi.mock("@/lib/invoices/refundCreditNotes", () => ({ sendCreditNotesForStripeRefunds: mocks.sendCreditNotes }));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderActionEvent: mocks.createOrderActionEvent }));
vi.mock("@/lib/orders/sendCustomerLifecycleEmail", () => ({ sendLifecycleEmailsForOrders: mocks.sendLifecycleEmailsForOrders }));

import { refundOrderDifference } from "./refundOrderDifference";

// Paid 1 250 kr incl. VAT; the order now costs 1 000 kr incl. VAT.
const order = {
  id: "o1",
  companyId: "c1",
  displayId: 1042,
  orderNumber: "583920",
  status: "confirmed",
  isWebsiteOrder: true,
  customerName: "Kari",
  customerLabel: null,
  statusNotes: null,
  actionToken: null,
  email: null,
  emailThreadToken: null,
  priceExVat: 800,
  rabatt: null,
  leggTil: null,
  pricingSnapshot: { customer: { totalExVat: 800, totalIncVat: 1000 }, lines: [] },
  websiteOrderKind: "WHITE_GOODS",
  websiteBookingDetails: null,
  pickupAddress: null,
  deliveryAddress: null,
  extraPickupAddress: [],
  deliveryDate: null,
  timeWindow: null,
  drivingDistance: null,
  payments: [{ amountChargedCents: 125000, createdAt: new Date("2026-11-01T10:00:00Z"), orderSnapshot: null, refunds: [] }],
};

const actor = { type: "user" as const, label: "Ola" };

describe("refundOrderDifference", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the order paid again once the overpaid difference is refunded", async () => {
    mocks.orderFindFirst.mockResolvedValue(order);
    mocks.refundOrderPayments.mockResolvedValue({ ok: true, refundedCents: 25000, stripeRefundIds: ["re_1"] });

    const result = await refundOrderDifference({ orderId: "o1", companyId: "c1", actor: actor as never });

    expect(result).toEqual({ ok: true, refundedCents: 25000, emailFailed: false });
    expect(mocks.orderUpdate).toHaveBeenCalledWith({ where: { id: "o1" }, data: { paymentStatus: "paid" } });
    expect(mocks.sendCreditNotes).toHaveBeenCalledWith(["re_1"]);
  });

  it("leaves the payment status alone when the refund fails", async () => {
    mocks.orderFindFirst.mockResolvedValue(order);
    mocks.refundOrderPayments.mockResolvedValue({ ok: false, reason: "STRIPE_ERROR", refundedCents: 0, stripeRefundIds: [] });

    expect(await refundOrderDifference({ orderId: "o1", companyId: "c1", actor: actor as never })).toMatchObject({ ok: false, reason: "REFUND_FAILED" });
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
  });
});
