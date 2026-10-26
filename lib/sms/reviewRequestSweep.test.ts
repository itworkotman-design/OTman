import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  templateFindManyMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  orderUpdateManyMock: vi.fn(),
  sendOrderSmsMock: vi.fn(),
  isSmsConfiguredMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    smsTemplate: { findMany: mocks.templateFindManyMock },
    order: { findMany: mocks.orderFindManyMock, updateMany: mocks.orderUpdateManyMock },
  },
}));

vi.mock("@/lib/sms/sendOrderSms", () => ({ sendOrderSms: mocks.sendOrderSmsMock }));
vi.mock("@/lib/sms/gatewayApi", () => ({ isSmsConfigured: mocks.isSmsConfiguredMock }));

import { runReviewRequestSmsSweep } from "./reviewRequestSweep";

// 2026-10-26 is after the DST switch: Oslo = UTC+1. 13:00 UTC = 14:00 Oslo.
const AFTERNOON_OSLO = new Date("2026-10-26T13:00:00Z");

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    companyId: "company-1",
    status: "completed",
    phone: "40284977",
    phoneTwo: null,
    displayId: 20001,
    orderNumber: null,
    customerName: "Kari",
    deliveryDate: "2026-10-26",
    timeWindow: null,
    deliveryAddress: "Storgata 1",
    pickupAddress: null,
    productsSummary: null,
    deliveryTypeSummary: null,
    servicesSummary: null,
    ...overrides,
  };
}

describe("runReviewRequestSmsSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSmsConfiguredMock.mockReturnValue(true);
    mocks.templateFindManyMock.mockResolvedValue([{ companyId: "company-1", body: "Takk {name}! https://otman.no/reviews" }]);
    mocks.orderFindManyMock.mockResolvedValue([makeOrder()]);
    mocks.orderUpdateManyMock.mockResolvedValue({ count: 1 });
    mocks.sendOrderSmsMock.mockResolvedValue({ ok: true, messageId: "sms-1" });
  });

  it("only texts customers between 09:00 and 22:00 Oslo time", async () => {
    // 08:59 and 22:00 Oslo (UTC+1).
    for (const now of [new Date("2026-10-26T07:59:00Z"), new Date("2026-10-26T21:00:00Z")]) {
      const summary = await runReviewRequestSmsSweep({ now });
      expect(summary).toMatchObject({ skippedReason: "OUTSIDE_SEND_HOURS", sent: 0 });
    }
    expect(mocks.orderFindManyMock).not.toHaveBeenCalled();

    // 21:30 Oslo is still inside the window.
    expect(await runReviewRequestSmsSweep({ now: new Date("2026-10-26T20:30:00Z") })).toMatchObject({ sent: 1 });
  });

  it("does nothing when not configured or when no company has the template enabled", async () => {
    mocks.isSmsConfiguredMock.mockReturnValueOnce(false);
    expect(await runReviewRequestSmsSweep({ now: AFTERNOON_OSLO })).toMatchObject({ skippedReason: "NOT_CONFIGURED" });

    mocks.templateFindManyMock.mockResolvedValueOnce([]);
    expect(await runReviewRequestSmsSweep({ now: AFTERNOON_OSLO })).toMatchObject({ skippedReason: "NO_ENABLED_TEMPLATE" });
    expect(mocks.templateFindManyMock).toHaveBeenCalledWith({
      where: { kind: "REVIEW_REQUEST", enabled: true },
      select: { companyId: true, body: true },
    });
    expect(mocks.orderFindManyMock).not.toHaveBeenCalled();
  });

  it("only looks at orders GSM completed today (Oslo time) with a delivery date in the last 7 days", async () => {
    await runReviewRequestSmsSweep({ now: AFTERNOON_OSLO });

    expect(mocks.orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: { in: ["company-1"] },
          status: { in: ["completed", "ferdig"], mode: "insensitive" },
          // Only the GSM webhook sets gsmCompletedAt, so manual completions never qualify.
          // Midnight 2026-10-26 in Oslo (UTC+1) — yesterday evening's completions are excluded.
          gsmCompletedAt: { gte: new Date("2026-10-25T23:00:00Z") },
          deliveryDate: { gte: "2026-10-19" },
          reviewSmsSentAt: null,
          gdprAnonymized: false,
        },
      }),
    );
  });

  it("uses Oslo midnight correctly on the day DST ends", async () => {
    // 2026-10-25: clocks go back at 03:00, so midnight was still UTC+2.
    await runReviewRequestSmsSweep({ now: new Date("2026-10-25T12:00:00Z") });

    expect(mocks.orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ gsmCompletedAt: { gte: new Date("2026-10-24T22:00:00Z") } }),
      }),
    );
  });

  it("claims the order and sends the review request using the company's template", async () => {
    const summary = await runReviewRequestSmsSweep({ now: AFTERNOON_OSLO });

    expect(mocks.orderUpdateManyMock).toHaveBeenCalledWith({
      where: { id: "order-1", reviewSmsSentAt: null },
      data: { reviewSmsSentAt: AFTERNOON_OSLO },
    });
    expect(mocks.sendOrderSmsMock).toHaveBeenCalledWith({
      order: { id: "order-1", companyId: "company-1" },
      toPhone: "40284977",
      body: "Takk Kari! https://otman.no/reviews",
      kind: "REVIEW_REQUEST",
      actor: expect.objectContaining({ source: "SYSTEM" }),
    });
    expect(summary).toEqual({ scanned: 1, sent: 1, failed: 0, skipped: 0 });
  });

  it("skips orders without a phone and orders another run already claimed", async () => {
    mocks.orderFindManyMock.mockResolvedValue([makeOrder({ id: "nophone", phone: null }), makeOrder({ id: "taken" })]);
    mocks.orderUpdateManyMock.mockResolvedValue({ count: 0 });

    const summary = await runReviewRequestSmsSweep({ now: AFTERNOON_OSLO });

    expect(mocks.sendOrderSmsMock).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ scanned: 2, sent: 0, skipped: 2 });
  });
});
