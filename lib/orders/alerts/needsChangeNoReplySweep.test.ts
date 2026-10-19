import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  notificationFindMany: vi.fn(),
  createOrderNotification: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findMany: mocks.orderFindMany },
    orderNotification: { findMany: mocks.notificationFindMany },
  },
}));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: mocks.createOrderNotification }));

import {
  buildNeedsChangeNoReplyAlert,
  isAwaitingReplyOnDeliveryDay,
  runNeedsChangeNoReplySweep,
} from "./needsChangeNoReplySweep";

const rejectedAt = new Date("2026-10-15T09:00:00Z");

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "o1",
    companyId: "c1",
    displayId: 20500,
    orderNumber: "AB12CD",
    status: "rejected",
    statusNotes: "Vi trenger etasjen.",
    deliveryDate: "2026-10-19",
    timeWindow: "08:00-12:00",
    rejectedAt,
    lastInboundEmailAt: null as Date | null,
    ...overrides,
  };
}

describe("isAwaitingReplyOnDeliveryDay", () => {
  const today = "2026-10-19";

  it("is true for a needs-change order whose delivery date is today or past, with no reply since", () => {
    expect(isAwaitingReplyOnDeliveryDay(order(), today)).toBe(true);
    expect(isAwaitingReplyOnDeliveryDay(order({ deliveryDate: "2026-10-17" }), today)).toBe(true);
    expect(isAwaitingReplyOnDeliveryDay(order({ status: "Avvist" }), today)).toBe(true);
  });

  it("is false before the delivery date", () => {
    expect(isAwaitingReplyOnDeliveryDay(order({ deliveryDate: "2026-10-20" }), today)).toBe(false);
  });

  it("is false once the customer has emailed since it was rejected", () => {
    expect(isAwaitingReplyOnDeliveryDay(order({ lastInboundEmailAt: new Date("2026-10-16T10:00:00Z") }), today)).toBe(false);
    // An email from before the rejection isn't a reply to it.
    expect(isAwaitingReplyOnDeliveryDay(order({ lastInboundEmailAt: new Date("2026-10-14T10:00:00Z") }), today)).toBe(true);
  });

  it("is false for any other status, or without a usable date", () => {
    expect(isAwaitingReplyOnDeliveryDay(order({ status: "processing" }), today)).toBe(false);
    expect(isAwaitingReplyOnDeliveryDay(order({ deliveryDate: null }), today)).toBe(false);
    expect(isAwaitingReplyOnDeliveryDay(order({ deliveryDate: "neste uke" }), today)).toBe(false);
  });
});

describe("buildNeedsChangeNoReplyAlert", () => {
  it("says what's waiting, since when, and what to do — no auto-cancel", () => {
    const alert = buildNeedsChangeNoReplyAlert(order());

    expect(alert.title).toBe("Needs change — no reply by the delivery date");
    expect(alert.message).toContain("2026-10-19");
    expect(alert.message).toContain("Vi trenger etasjen.");
    expect(alert.message).toContain("Contact the customer");
    expect(alert.payload).toEqual({ kind: "NEEDS_CHANGE_NO_REPLY", rejectedAt: rejectedAt.toISOString() });
  });
});

describe("runNeedsChangeNoReplySweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // 07:00 in Oslo on 19 October.
    vi.setSystemTime(new Date("2026-10-19T05:00:00Z"));
    mocks.notificationFindMany.mockResolvedValue([]);
    mocks.createOrderNotification.mockResolvedValue({ id: "n1" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queries open needs-change website orders due by today (Oslo)", async () => {
    mocks.orderFindMany.mockResolvedValue([]);

    await runNeedsChangeNoReplySweep();

    expect(mocks.orderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isWebsiteOrder: true,
          gdprAnonymized: false,
          status: { in: ["rejected", "avvist"], mode: "insensitive" },
          deliveryDate: { lte: "2026-10-19" },
        }),
      }),
    );
  });

  it("alerts each waiting order once per rejection, and skips the rest", async () => {
    mocks.orderFindMany.mockResolvedValue([
      order({ id: "waiting" }),
      order({ id: "replied", lastInboundEmailAt: new Date("2026-10-16T10:00:00Z") }),
      order({ id: "already-alerted" }),
    ]);
    mocks.notificationFindMany.mockImplementation(async ({ where }: { where: { orderId: string } }) =>
      where.orderId === "already-alerted"
        ? [{ payload: { kind: "NEEDS_CHANGE_NO_REPLY", rejectedAt: rejectedAt.toISOString() } }]
        : [],
    );

    const summary = await runNeedsChangeNoReplySweep();

    expect(summary).toEqual({ scanned: 3, created: 1, skipped: 2, failed: 0 });
    expect(mocks.createOrderNotification).toHaveBeenCalledTimes(1);
    expect(mocks.createOrderNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "waiting", companyId: "c1", type: "MANUAL_REVIEW" }),
    );
  });

  it("alerts again after the order is rejected a second time", async () => {
    mocks.orderFindMany.mockResolvedValue([order()]);
    mocks.notificationFindMany.mockResolvedValue([
      { payload: { kind: "NEEDS_CHANGE_NO_REPLY", rejectedAt: "2026-10-01T09:00:00.000Z" } },
    ]);

    expect((await runNeedsChangeNoReplySweep()).created).toBe(1);
  });

  it("counts a failure and carries on", async () => {
    mocks.orderFindMany.mockResolvedValue([order({ id: "a" }), order({ id: "b" })]);
    mocks.createOrderNotification.mockRejectedValueOnce(new Error("db down"));

    expect(await runNeedsChangeNoReplySweep()).toEqual({ scanned: 2, created: 1, skipped: 0, failed: 1 });
  });
});
