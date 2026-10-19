import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSession: vi.fn(),
  membershipFindFirst: vi.fn(),
  orderFindFirst: vi.fn(),
  orderUpdate: vi.fn(),
  orderUpdateMany: vi.fn(),
  refundOrderPayments: vi.fn(),
  createOrderStatusChangedEvent: vi.fn(),
  resolveAllOrderNotifications: vi.fn(),
  sendLifecycleEmailsForOrders: vi.fn(),
  findCancelledOrderPartner: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthenticatedSession: mocks.getAuthenticatedSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirst },
    order: { findFirst: mocks.orderFindFirst, update: mocks.orderUpdate, updateMany: mocks.orderUpdateMany },
  },
}));
vi.mock("@/lib/stripe/stripeClient", () => ({ getStripeClient: () => ({ refunds: {} }) }));
vi.mock("@/lib/orders/orderRefunds", () => ({ refundOrderPayments: mocks.refundOrderPayments }));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderStatusChangedEvent: mocks.createOrderStatusChangedEvent }));
vi.mock("@/lib/orders/orderNotifications", () => ({ resolveAllOrderNotifications: mocks.resolveAllOrderNotifications }));
vi.mock("@/lib/orders/sendCustomerLifecycleEmail", () => ({
  sendLifecycleEmailsForOrders: mocks.sendLifecycleEmailsForOrders,
}));
vi.mock("@/lib/orders/cancelledOrderPartner", () => ({ findCancelledOrderPartner: mocks.findCancelledOrderPartner }));

import { POST } from "./route";

const order = {
  id: "o1",
  companyId: "c1",
  displayId: 20500,
  orderNumber: "AB12CD",
  status: "confirmed",
  isWebsiteOrder: true,
  customerName: "Ola Nordmann",
  customerLabel: null,
  statusNotes: null,
  actionToken: "t".repeat(32),
  email: "ola@example.com",
  emailThreadToken: null,
  subcontractorMembershipId: null,
  subcontractor: null,
};

const ownerMembership = { id: "m1", role: "OWNER", appAccess: [], user: { username: "Eier", email: "eier@otman.no" } };

function post(body: unknown) {
  return POST(new Request("http://localhost/api/orders/o1/decline", { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ orderId: "o1" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedSession.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
  mocks.membershipFindFirst.mockResolvedValue(ownerMembership);
  mocks.orderFindFirst.mockResolvedValue(order);
  mocks.orderUpdate.mockResolvedValue({});
  mocks.orderUpdateMany.mockResolvedValue({ count: 1 });
  mocks.refundOrderPayments.mockResolvedValue({ ok: true, refundedCents: 1250_00 });
  mocks.sendLifecycleEmailsForOrders.mockResolvedValue({ sentCount: 1, failedOrderIds: [] });
  mocks.findCancelledOrderPartner.mockResolvedValue(null);
});

describe("POST /api/orders/[orderId]/decline", () => {
  it("is 401 without a session", async () => {
    mocks.getAuthenticatedSession.mockResolvedValue(null);
    expect((await post({ reason: "x" })).status).toBe(401);
  });

  it("is 403 for someone who can only view website orders", async () => {
    mocks.membershipFindFirst.mockResolvedValue({
      ...ownerMembership,
      role: "USER",
      appAccess: [{ module: "WEBSITE_ORDERS", enabled: true, level: "VIEWER" }],
    });
    expect((await post({ reason: "x" })).status).toBe(403);
    expect(mocks.refundOrderPayments).not.toHaveBeenCalled();
  });

  it("is 404 for an order outside the company, or one that isn't a website order", async () => {
    mocks.orderFindFirst.mockResolvedValueOnce(null);
    expect((await post({ reason: "x" })).status).toBe(404);

    mocks.orderFindFirst.mockResolvedValueOnce({ ...order, isWebsiteOrder: false });
    expect((await post({ reason: "x" })).status).toBe(404);
  });

  it("needs a reason — the customer is told why", async () => {
    const res = await post({ reason: "   " });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "REASON_REQUIRED" });
  });

  it("refuses an order that is already finished or closed", async () => {
    for (const status of ["completed", "cancelled", "refunded"]) {
      mocks.orderFindFirst.mockResolvedValueOnce({ ...order, status });
      const res = await post({ reason: "x" });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ ok: false, reason: "NOT_DECLINABLE" });
    }
    expect(mocks.refundOrderPayments).not.toHaveBeenCalled();
  });

  it("refunds everything paid, then marks the order refunded and emails the customer", async () => {
    const res = await post({ reason: "Vi kjører ikke dit." });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: "refunded", refundedCents: 1250_00 });
    expect(mocks.refundOrderPayments).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      orderId: "o1",
      companyId: "c1",
      amountCents: "ALL",
      reason: "Vi kjører ikke dit.",
    });
    expect(mocks.orderUpdate).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: expect.objectContaining({ status: "refunded", statusNotes: "Vi kjører ikke dit.", lastEditedByMembershipId: "m1" }),
    });
    expect(mocks.createOrderStatusChangedEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "o1", fromStatus: "confirmed", toStatus: "refunded", note: "Vi kjører ikke dit." }),
    );
    expect(mocks.resolveAllOrderNotifications).toHaveBeenCalled();
    expect(mocks.sendLifecycleEmailsForOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "order_declined",
        orders: [expect.objectContaining({ id: "o1", statusNotes: "Vi kjører ikke dit.", refundedIncVatNok: 1250 })],
      }),
    );
  });

  it("just cancels an order nothing was paid on (e.g. a service awaiting its payment link)", async () => {
    mocks.refundOrderPayments.mockResolvedValue({ ok: false, reason: "NOTHING_TO_REFUND" });

    const res = await post({ reason: "Fullt den dagen." });

    expect(await res.json()).toEqual({ ok: true, status: "cancelled", refundedCents: 0 });
    expect(mocks.orderUpdate).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: expect.objectContaining({ status: "cancelled" }),
    });
    expect(mocks.sendLifecycleEmailsForOrders).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "order_declined", orders: [expect.objectContaining({ refundedIncVatNok: 0 })] }),
    );
  });

  it("leaves the order untouched and sends nothing when Stripe fails", async () => {
    mocks.refundOrderPayments.mockResolvedValue({ ok: false, reason: "STRIPE_ERROR", refundedCents: 300_00 });

    const res = await post({ reason: "x" });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, reason: "REFUND_FAILED", refundedCents: 300_00 });
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
    expect(mocks.sendLifecycleEmailsForOrders).not.toHaveBeenCalled();
  });

  it("refuses when a payment can't be refunded through Stripe (no payment intent on record)", async () => {
    mocks.refundOrderPayments.mockResolvedValue({ ok: false, reason: "MISSING_PAYMENT_INTENT" });

    const res = await post({ reason: "x" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "REFUND_NOT_POSSIBLE" });
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
  });

  it("gives an order with no partner the cancelled-order placeholder partner", async () => {
    mocks.findCancelledOrderPartner.mockResolvedValue({ subcontractorMembershipId: "m-cancel", subcontractor: "Kansellert" });

    await post({ reason: "x" });

    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: { id: "o1", subcontractorMembershipId: null, OR: [{ subcontractor: null }, { subcontractor: "" }] },
      data: { subcontractorMembershipId: "m-cancel", subcontractor: "Kansellert" },
    });
  });

  it("still succeeds when the email fails — the money has already gone back", async () => {
    mocks.sendLifecycleEmailsForOrders.mockRejectedValue(new Error("gmail down"));

    const res = await post({ reason: "x" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: "refunded", refundedCents: 1250_00, emailFailed: true });
  });
});
