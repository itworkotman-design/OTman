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

import { getOsloDateParts, runDayOfDeliverySmsSweep } from "./dayOfDeliverySweep";

// 2026-10-26 is after the DST switch: Oslo = UTC+1. 08:05 UTC = 09:05 Oslo.
const NINE_OSLO = new Date("2026-10-26T08:05:00Z");

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    companyId: "company-1",
    status: "confirmed",
    phone: "40284977",
    phoneTwo: null,
    displayId: 20001,
    orderNumber: null,
    customerName: "Kari",
    deliveryDate: "2026-10-26",
    timeWindow: "10:00-14:00",
    deliveryAddress: "Storgata 1",
    productsSummary: "Kjøleskap",
    deliveryTypeSummary: null,
    servicesSummary: null,
    ...overrides,
  };
}

describe("getOsloDateParts", () => {
  it("uses Europe/Oslo local time across DST", () => {
    expect(getOsloDateParts(new Date("2026-10-26T08:05:00Z"))).toEqual({ date: "2026-10-26", hour: 9 });
    expect(getOsloDateParts(new Date("2026-07-01T07:00:00Z"))).toEqual({ date: "2026-07-01", hour: 9 });
    expect(getOsloDateParts(new Date("2026-10-25T23:30:00Z"))).toEqual({ date: "2026-10-26", hour: 0 });
  });
});

describe("runDayOfDeliverySmsSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSmsConfiguredMock.mockReturnValue(true);
    mocks.templateFindManyMock.mockResolvedValue([
      { companyId: "company-1", body: "Hei {name}, vi kommer i dag til {address}." },
    ]);
    mocks.orderFindManyMock.mockResolvedValue([makeOrder()]);
    mocks.orderUpdateManyMock.mockResolvedValue({ count: 1 });
    mocks.sendOrderSmsMock.mockResolvedValue({ ok: true, messageId: "sms-1" });
  });

  it("does nothing before 09:00 Oslo time", async () => {
    const summary = await runDayOfDeliverySmsSweep({ now: new Date("2026-10-26T07:30:00Z") });
    expect(summary).toMatchObject({ skippedReason: "BEFORE_SEND_HOUR", sent: 0 });
    expect(mocks.orderFindManyMock).not.toHaveBeenCalled();
  });

  it("does nothing when GatewayAPI is not configured", async () => {
    mocks.isSmsConfiguredMock.mockReturnValue(false);
    const summary = await runDayOfDeliverySmsSweep({ now: NINE_OSLO });
    expect(summary).toMatchObject({ skippedReason: "NOT_CONFIGURED" });
    expect(mocks.orderFindManyMock).not.toHaveBeenCalled();
  });

  it("does nothing when no company has the automatic template enabled", async () => {
    mocks.templateFindManyMock.mockResolvedValue([]);
    const summary = await runDayOfDeliverySmsSweep({ now: NINE_OSLO });
    expect(summary).toMatchObject({ skippedReason: "NO_ENABLED_TEMPLATE" });
    expect(mocks.templateFindManyMock).toHaveBeenCalledWith({
      where: { kind: "DAY_OF_DELIVERY", enabled: true },
      select: { companyId: true, body: true },
    });
    expect(mocks.orderFindManyMock).not.toHaveBeenCalled();
  });

  it("claims and texts today's orders using the company's template", async () => {
    const summary = await runDayOfDeliverySmsSweep({ now: NINE_OSLO });

    expect(mocks.orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: { in: ["company-1"] },
          deliveryDate: "2026-10-26",
          dayOfDeliverySmsSentAt: null,
          gdprAnonymized: false,
        }),
      }),
    );
    expect(mocks.orderUpdateManyMock).toHaveBeenCalledWith({
      where: { id: "order-1", dayOfDeliverySmsSentAt: null },
      data: { dayOfDeliverySmsSentAt: NINE_OSLO },
    });
    expect(mocks.sendOrderSmsMock).toHaveBeenCalledWith({
      order: { id: "order-1", companyId: "company-1" },
      toPhone: "40284977",
      body: "Hei Kari, vi kommer i dag til Storgata 1.",
      kind: "DAY_OF_DELIVERY",
      actor: expect.objectContaining({ source: "SYSTEM" }),
    });
    expect(summary).toEqual({ date: "2026-10-26", scanned: 1, sent: 1, failed: 0, skipped: 0 });
  });

  it("skips orders in a closed status or without any phone, and falls back to phoneTwo", async () => {
    mocks.orderFindManyMock.mockResolvedValue([
      makeOrder({ id: "cancelled", status: "Kanselert" }),
      makeOrder({ id: "pending", status: "pending" }),
      makeOrder({ id: "done", status: "completed" }),
      makeOrder({ id: "nophone", phone: null, phoneTwo: " " }),
      makeOrder({ id: "second", phone: null, phoneTwo: "99887766" }),
    ]);

    const summary = await runDayOfDeliverySmsSweep({ now: NINE_OSLO });

    expect(mocks.sendOrderSmsMock).toHaveBeenCalledTimes(1);
    expect(mocks.sendOrderSmsMock).toHaveBeenCalledWith(expect.objectContaining({ toPhone: "99887766" }));
    expect(summary).toMatchObject({ scanned: 5, sent: 1, skipped: 4 });
  });

  it("skips an order another run already claimed", async () => {
    mocks.orderUpdateManyMock.mockResolvedValue({ count: 0 });
    const summary = await runDayOfDeliverySmsSweep({ now: NINE_OSLO });
    expect(mocks.sendOrderSmsMock).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ sent: 0, skipped: 1 });
  });

  it("counts provider failures and keeps going", async () => {
    mocks.orderFindManyMock.mockResolvedValue([makeOrder({ id: "a" }), makeOrder({ id: "b" })]);
    mocks.sendOrderSmsMock
      .mockResolvedValueOnce({ ok: false, reason: "boom" })
      .mockRejectedValueOnce(new Error("db down"));

    const summary = await runDayOfDeliverySmsSweep({ now: NINE_OSLO });

    expect(summary).toMatchObject({ scanned: 2, sent: 0, failed: 2 });
  });
});
