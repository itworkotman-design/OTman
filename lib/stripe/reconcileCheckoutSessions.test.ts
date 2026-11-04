import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  handleCompleted: vi.fn(),
  handleExpired: vi.fn(),
  alertStaff: vi.fn(),
  retrieve: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { order: { findMany: mocks.orderFindMany } } }));
vi.mock("@/lib/stripe/checkoutSessionHandlers", () => ({
  handleCheckoutSessionCompleted: mocks.handleCompleted,
  handleCheckoutSessionExpired: mocks.handleExpired,
}));
vi.mock("@/lib/orders/staffAlerts", () => ({ alertStaff: mocks.alertStaff }));

import { RECONCILE_LOOKBACK_DAYS, RECONCILE_MIN_AGE_MINUTES, reconcileCheckoutSessions } from "./reconcileCheckoutSessions";

const NOW = new Date("2026-11-04T12:00:00Z");
const stripe = { checkout: { sessions: { retrieve: mocks.retrieve } } };
const minutesAgo = (m: number) => Math.floor((NOW.getTime() - m * 60_000) / 1000);
const session = (over: Record<string, unknown> = {}) => ({
  id: "cs_1",
  status: "complete",
  payment_status: "paid",
  amount_total: 100000,
  created: minutesAgo(60),
  metadata: { orderId: "o1", chargeKind: "topup" },
  ...over,
});
const order = (over: Record<string, unknown> = {}) => ({ id: "o1", companyId: "c1", stripeCheckoutSessionId: "cs_1", payments: [], ...over });

describe("reconcileCheckoutSessions — Stripe payments whose webhook never arrived", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orderFindMany.mockResolvedValue([]);
    mocks.handleCompleted.mockResolvedValue(true);
  });

  it("looks at recent homepage orders with a checkout session", async () => {
    await reconcileCheckoutSessions({ stripe, now: NOW });

    expect(RECONCILE_LOOKBACK_DAYS).toBe(7);
    expect(mocks.orderFindMany.mock.calls[0]![0].where).toEqual({
      isWebsiteOrder: true,
      stripeCheckoutSessionId: { not: null },
      updatedAt: { gte: new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000) },
    });
  });

  it("records a paid session the app never heard about, and tells staff it came in late", async () => {
    mocks.orderFindMany.mockResolvedValue([order()]);
    mocks.retrieve.mockResolvedValue(session());

    expect(await reconcileCheckoutSessions({ stripe, now: NOW })).toEqual({ checked: 1, recovered: 1, expired: 0, failed: 0 });

    expect(mocks.handleCompleted).toHaveBeenCalledWith(session());
    expect(mocks.alertStaff).toHaveBeenCalledWith({
      orderId: "o1",
      companyId: "c1",
      title: "Stripe payment recorded late",
      message: expect.stringContaining("cs_1"),
    });
  });

  it("skips a session already recorded as a payment, without asking Stripe", async () => {
    mocks.orderFindMany.mockResolvedValue([order({ payments: [{ stripeCheckoutSessionId: "cs_1" }] })]);

    expect(await reconcileCheckoutSessions({ stripe, now: NOW })).toEqual({ checked: 0, recovered: 0, expired: 0, failed: 0 });
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });

  it(`leaves a session younger than ${RECONCILE_MIN_AGE_MINUTES} minutes to its webhook`, async () => {
    mocks.orderFindMany.mockResolvedValue([order()]);
    mocks.retrieve.mockResolvedValue(session({ created: minutesAgo(2) }));

    expect(await reconcileCheckoutSessions({ stripe, now: NOW })).toMatchObject({ recovered: 0 });
    expect(mocks.handleCompleted).not.toHaveBeenCalled();
  });

  it("doesn't alert when the webhook beat it to it (nothing new recorded)", async () => {
    mocks.orderFindMany.mockResolvedValue([order()]);
    mocks.retrieve.mockResolvedValue(session());
    mocks.handleCompleted.mockResolvedValue(false);

    expect(await reconcileCheckoutSessions({ stripe, now: NOW })).toMatchObject({ recovered: 0 });
    expect(mocks.alertStaff).not.toHaveBeenCalled();
  });

  it("runs the expiry for an expired session (an unpaid booking is cancelled)", async () => {
    mocks.orderFindMany.mockResolvedValue([order()]);
    const expired = session({ status: "expired", payment_status: "unpaid", metadata: { orderId: "o1", chargeKind: "booking" } });
    mocks.retrieve.mockResolvedValue(expired);

    expect(await reconcileCheckoutSessions({ stripe, now: NOW })).toMatchObject({ expired: 1 });
    expect(mocks.handleExpired).toHaveBeenCalledWith(expired);
  });

  it("leaves an open, unpaid session alone", async () => {
    mocks.orderFindMany.mockResolvedValue([order()]);
    mocks.retrieve.mockResolvedValue(session({ status: "open", payment_status: "unpaid" }));

    expect(await reconcileCheckoutSessions({ stripe, now: NOW })).toEqual({ checked: 1, recovered: 0, expired: 0, failed: 0 });
    expect(mocks.handleCompleted).not.toHaveBeenCalled();
    expect(mocks.handleExpired).not.toHaveBeenCalled();
  });

  it("skips a session this Stripe account doesn't know (e.g. made with other keys) instead of failing every run", async () => {
    mocks.orderFindMany.mockResolvedValue([order()]);
    mocks.retrieve.mockRejectedValue(Object.assign(new Error("No such checkout.session: cs_1"), { code: "resource_missing" }));

    expect(await reconcileCheckoutSessions({ stripe, now: NOW })).toEqual({ checked: 1, recovered: 0, expired: 0, failed: 0 });
  });

  it("counts a failure and carries on", async () => {
    mocks.orderFindMany.mockResolvedValue([order({ id: "a", stripeCheckoutSessionId: "cs_a" }), order({ id: "b", stripeCheckoutSessionId: "cs_b" })]);
    mocks.retrieve.mockRejectedValueOnce(new Error("stripe down")).mockResolvedValueOnce(session({ id: "cs_b", metadata: { orderId: "b" } }));

    expect(await reconcileCheckoutSessions({ stripe, now: NOW })).toEqual({ checked: 2, recovered: 1, expired: 0, failed: 1 });
  });
});
