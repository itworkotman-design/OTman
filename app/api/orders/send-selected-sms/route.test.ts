import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSmsAdminMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  sendOrderSmsMock: vi.fn(),
}));

vi.mock("@/lib/sms/smsAccess", () => ({ requireSmsAdmin: mocks.requireSmsAdminMock }));
vi.mock("@/lib/sms/sendOrderSms", () => ({ sendOrderSms: mocks.sendOrderSmsMock }));
vi.mock("@/lib/db", () => ({ prisma: { order: { findMany: mocks.orderFindManyMock } } }));

import { POST } from "./route";

const actor = { membershipId: "m-1", name: "Ola", email: "o@otman.no", source: "USER" };

function makeOrder(id: string, displayId: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    companyId: "c-1",
    displayId,
    phone: "40284977",
    phoneTwo: null,
    orderNumber: null,
    customerName: `Kunde ${displayId}`,
    deliveryDate: "2026-10-27",
    timeWindow: null,
    deliveryAddress: `Gate ${displayId}`,
    pickupAddress: null,
    productsSummary: null,
    deliveryTypeSummary: null,
    servicesSummary: null,
    ...overrides,
  };
}

function post(body: unknown) {
  return POST(new Request("http://localhost/api/orders/send-selected-sms", { method: "POST", body: JSON.stringify(body) }));
}

describe("POST /api/orders/send-selected-sms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSmsAdminMock.mockResolvedValue({ ok: true, companyId: "c-1", membershipId: "m-1", actor });
    mocks.orderFindManyMock.mockResolvedValue([makeOrder("a", 1), makeOrder("b", 2)]);
    mocks.sendOrderSmsMock.mockResolvedValue({ ok: true, messageId: "sms" });
  });

  it("passes through the access check's error response", async () => {
    mocks.requireSmsAdminMock.mockResolvedValue({ ok: false, response: NextResponse.json({ ok: false }, { status: 401 }) });
    expect((await post({ orderIds: ["a"], message: "Hei" })).status).toBe(401);
  });

  it("validates order ids and message", async () => {
    expect((await post({ orderIds: [], message: "Hei" })).status).toBe(400);
    expect((await post({ orderIds: ["a"], message: "  " })).status).toBe(400);
    expect((await post({ orderIds: Array.from({ length: 201 }, (_, i) => `o${i}`), message: "Hei" })).status).toBe(400);
    expect(mocks.sendOrderSmsMock).not.toHaveBeenCalled();
  });

  it("texts each selected order's own customer with the message rendered for that order", async () => {
    const res = await post({ orderIds: ["a", "b"], message: "Hei {name}, vi kommer til {address}." });

    expect(mocks.orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["a", "b"] }, companyId: "c-1" } }),
    );
    expect(mocks.sendOrderSmsMock).toHaveBeenCalledWith({
      order: { id: "a", companyId: "c-1" },
      toPhone: "40284977",
      body: "Hei Kunde 1, vi kommer til Gate 1.",
      kind: "MANUAL",
      actor,
    });
    expect(mocks.sendOrderSmsMock).toHaveBeenCalledWith(expect.objectContaining({ body: "Hei Kunde 2, vi kommer til Gate 2." }));
    expect(await res.json()).toEqual({ ok: true, sentCount: 2, failed: [] });
  });

  it("reports per-order failures, including orders with no phone", async () => {
    mocks.orderFindManyMock.mockResolvedValue([
      makeOrder("a", 1),
      makeOrder("b", 2, { phone: null, phoneTwo: "99887766" }),
      makeOrder("c", 3, { phone: null, phoneTwo: null }),
    ]);
    mocks.sendOrderSmsMock
      .mockResolvedValueOnce({ ok: false, reason: "GatewayAPI 500", messageId: "x" })
      .mockResolvedValueOnce({ ok: true, messageId: "y" })
      .mockResolvedValueOnce({ ok: false, reason: "MISSING_PHONE" });

    const res = await post({ orderIds: ["a", "b", "c"], message: "Hei" });

    expect(mocks.sendOrderSmsMock).toHaveBeenCalledWith(expect.objectContaining({ toPhone: "99887766" }));
    expect(await res.json()).toEqual({
      ok: true,
      sentCount: 1,
      failed: [
        { orderId: "a", displayId: 1, reason: "GatewayAPI 500" },
        { orderId: "c", displayId: 3, reason: "MISSING_PHONE" },
      ],
    });
  });

  it("returns 503 without sending anything when SMS is not configured", async () => {
    mocks.sendOrderSmsMock.mockResolvedValue({ ok: false, reason: "SMS_NOT_CONFIGURED" });
    const res = await post({ orderIds: ["a", "b"], message: "Hei" });
    expect(res.status).toBe(503);
    expect(mocks.sendOrderSmsMock).toHaveBeenCalledTimes(1);
  });
});
