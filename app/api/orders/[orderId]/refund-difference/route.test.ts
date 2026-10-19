import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSession: vi.fn(),
  membershipFindFirst: vi.fn(),
  orderFindFirst: vi.fn(),
  refundOrderPayments: vi.fn(),
  compareOrderWithPayments: vi.fn(),
  buildOrderStateSnapshot: vi.fn(),
  createOrderActionEvent: vi.fn(),
  sendLifecycleEmailsForOrders: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthenticatedSession: mocks.getAuthenticatedSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirst },
    order: { findFirst: mocks.orderFindFirst },
  },
}));
vi.mock("@/lib/stripe/stripeClient", () => ({ getStripeClient: () => ({ refunds: {} }) }));
vi.mock("@/lib/orders/orderRefunds", () => ({ refundOrderPayments: mocks.refundOrderPayments }));
vi.mock("@/lib/orders/paidOrderSnapshot", async () => {
  const actual = await vi.importActual<typeof import("@/lib/orders/paidOrderSnapshot")>("@/lib/orders/paidOrderSnapshot");
  return {
    ...actual,
    compareOrderWithPayments: mocks.compareOrderWithPayments,
    buildOrderStateSnapshot: mocks.buildOrderStateSnapshot,
  };
});
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderActionEvent: mocks.createOrderActionEvent }));
vi.mock("@/lib/orders/sendCustomerLifecycleEmail", () => ({
  sendLifecycleEmailsForOrders: mocks.sendLifecycleEmailsForOrders,
}));

import { POST } from "./route";

const order = {
  id: "o1",
  companyId: "c1",
  displayId: 20500,
  orderNumber: "AB12CD",
  status: "active",
  isWebsiteOrder: true,
  customerName: "Ola Nordmann",
  customerLabel: null,
  statusNotes: null,
  actionToken: null,
  email: "ola@example.com",
  emailThreadToken: null,
  extraPickupAddress: [],
  payments: [],
};

const snapshot = { version: 1, totalIncVatNok: 975, lines: [], details: [] };
const discountLine = {
  kind: "added",
  group: "adjustment",
  label: "discount",
  qtyBefore: 0,
  qtyAfter: 1,
  priceBefore: 0,
  priceAfter: -125,
  delta: -125,
};
const overpaid = {
  outcome: "refund",
  totalPaidIncVatNok: 1100,
  currentTotalIncVatNok: 975,
  differenceIncVatNok: -125,
  hasPaidSnapshot: true,
  paidSnapshotTotalIncVatNok: 1100,
  paidAt: null,
  lineChanges: [discountLine],
  detailChanges: [],
};

function post(body: unknown) {
  return POST(new Request("http://localhost/api/orders/o1/refund-difference", { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ orderId: "o1" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedSession.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
  mocks.membershipFindFirst.mockResolvedValue({ id: "m1", role: "OWNER", appAccess: [], user: { username: "Eier", email: "eier@otman.no" } });
  mocks.orderFindFirst.mockResolvedValue(order);
  mocks.buildOrderStateSnapshot.mockReturnValue(snapshot);
  mocks.compareOrderWithPayments.mockReturnValue(overpaid);
  mocks.refundOrderPayments.mockResolvedValue({ ok: true, refundedCents: 125_00 });
  mocks.sendLifecycleEmailsForOrders.mockResolvedValue({ sentCount: 1, failedOrderIds: [] });
});

describe("POST /api/orders/[orderId]/refund-difference", () => {
  it("is 401 without a session and 403 for a website-orders viewer", async () => {
    mocks.getAuthenticatedSession.mockResolvedValueOnce(null);
    expect((await post({ amountCents: 125_00 })).status).toBe(401);

    mocks.membershipFindFirst.mockResolvedValueOnce({
      id: "m2",
      role: "USER",
      appAccess: [{ module: "WEBSITE_ORDERS", enabled: true, level: "VIEWER" }],
      user: { username: null, email: "x@otman.no" },
    });
    expect((await post({ amountCents: 125_00 })).status).toBe(403);
    expect(mocks.refundOrderPayments).not.toHaveBeenCalled();
  });

  it("is 404 for an order outside the company or not from the website", async () => {
    mocks.orderFindFirst.mockResolvedValueOnce(null);
    expect((await post({ amountCents: 125_00 })).status).toBe(404);
    mocks.orderFindFirst.mockResolvedValueOnce({ ...order, isWebsiteOrder: false });
    expect((await post({ amountCents: 125_00 })).status).toBe(404);
  });

  it("refunds exactly what was overpaid, saving the order as it is now as the new paid state", async () => {
    const res = await post({ amountCents: 125_00 });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, refundedCents: 125_00 });
    expect(mocks.refundOrderPayments).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      orderId: "o1",
      companyId: "c1",
      amountCents: 125_00,
      reason: "Price lowered after payment",
      orderSnapshot: snapshot,
    });
  });

  it("logs the refund on the order and emails the customer the amount, the changes and the new total", async () => {
    await post({ amountCents: 125_00 });

    expect(mocks.createOrderActionEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "o1", title: expect.stringContaining("125") }),
    );
    expect(mocks.sendLifecycleEmailsForOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "refund_issued",
        orders: [
          expect.objectContaining({
            id: "o1",
            refundIssued: { refundedIncVatNok: 125, totalIncVatNok: 975, changes: [expect.any(String)] },
          }),
        ],
      }),
    );
  });

  it("refuses when nothing is overpaid", async () => {
    mocks.compareOrderWithPayments.mockReturnValue({ ...overpaid, outcome: "settled", differenceIncVatNok: 0 });

    const res = await post({ amountCents: 125_00 });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "NOTHING_TO_REFUND" });
    expect(mocks.refundOrderPayments).not.toHaveBeenCalled();
  });

  it("refuses when the amount on screen is no longer what's overpaid (the order changed meanwhile)", async () => {
    const res = await post({ amountCents: 200_00 });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "AMOUNT_CHANGED", amountCents: 125_00 });
    expect(mocks.refundOrderPayments).not.toHaveBeenCalled();
  });

  it("reports a Stripe failure without emailing", async () => {
    mocks.refundOrderPayments.mockResolvedValue({ ok: false, reason: "STRIPE_ERROR", refundedCents: 0 });

    const res = await post({ amountCents: 125_00 });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, reason: "REFUND_FAILED", refundedCents: 0 });
    expect(mocks.sendLifecycleEmailsForOrders).not.toHaveBeenCalled();
  });

  it("refuses when a payment can't be refunded through Stripe", async () => {
    mocks.refundOrderPayments.mockResolvedValue({ ok: false, reason: "MISSING_PAYMENT_INTENT" });

    const res = await post({ amountCents: 125_00 });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "REFUND_NOT_POSSIBLE" });
  });

  it("still succeeds when the email fails — the money has already gone back", async () => {
    mocks.sendLifecycleEmailsForOrders.mockRejectedValue(new Error("gmail down"));

    const res = await post({ amountCents: 125_00 });

    expect(await res.json()).toEqual({ ok: true, refundedCents: 125_00, emailFailed: true });
  });
});
