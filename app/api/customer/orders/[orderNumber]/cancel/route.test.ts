import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCustomerSession: vi.fn(),
  findCustomerOrder: vi.fn(),
  orderUpdate: vi.fn(),
  orderUpdateMany: vi.fn(),
  emailMessageCreate: vi.fn(),
  transaction: vi.fn(),
  findCancelledOrderPartner: vi.fn(),
  createOrderStatusChangedEvent: vi.fn(),
  createOrderActionEvent: vi.fn(),
  createOrderNotification: vi.fn(),
}));

vi.mock("@/lib/customerAccounts/customerSession", () => ({ getCustomerSession: mocks.getCustomerSession }));
vi.mock("@/lib/customerAccounts/customerOrderView", () => ({ findCustomerOrder: mocks.findCustomerOrder }));
vi.mock("@/lib/db", () => ({
  prisma: {
    order: { update: mocks.orderUpdate, updateMany: mocks.orderUpdateMany },
    orderEmailMessage: { create: mocks.emailMessageCreate },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/orders/cancelledOrderPartner", () => ({ findCancelledOrderPartner: mocks.findCancelledOrderPartner }));
vi.mock("@/lib/orders/partnerRequirement", () => ({ isPartnerTrackedOrder: () => true }));
vi.mock("@/lib/orders/orderEvents", () => ({
  createOrderStatusChangedEvent: mocks.createOrderStatusChangedEvent,
  createOrderActionEvent: mocks.createOrderActionEvent,
}));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: mocks.createOrderNotification }));
vi.mock("@/lib/email/gmailAccounts", () => ({ getGmailSendAsEmail: () => "post@otman.no" }));

import { POST } from "./route";

const NOW = new Date("2026-10-05T10:00:00Z");

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    companyId: "c1",
    displayId: 42,
    orderNumber: "583920",
    status: "processing",
    deliveryDate: "2026-10-10",
    timeWindow: "10:00-16:00",
    websiteOrderKind: "WHITE_GOODS",
    customerName: "Kari",
    customerLabel: null,
    email: "kari@example.no",
    ...overrides,
  };
}

const params = { params: Promise.resolve({ orderNumber: "583920" }) };

function post(body: unknown = {}) {
  return POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }), params);
}

describe("POST /api/customer/orders/[orderNumber]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    mocks.getCustomerSession.mockResolvedValue({ sessionId: "s1", accountId: "acc-1", email: "kari@example.no" });
    mocks.findCustomerOrder.mockResolvedValue(order());
    mocks.findCancelledOrderPartner.mockResolvedValue(null);
    mocks.transaction.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("needs a session and the account's own order", async () => {
    mocks.getCustomerSession.mockResolvedValue(null);
    expect((await post()).status).toBe(401);
    mocks.getCustomerSession.mockResolvedValue({ sessionId: "s1", accountId: "acc-1", email: "x" });
    mocks.findCustomerOrder.mockResolvedValue(null);
    expect((await post()).status).toBe(404);
    expect(mocks.findCustomerOrder).toHaveBeenCalledWith("acc-1", "583920");
  });

  it("cancels straight away before the cutoff, and tells staff", async () => {
    const res = await post();

    expect(await res.json()).toEqual({ ok: true, mode: "cancelled" });
    expect(mocks.orderUpdate).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "cancelled", statusChangedAt: NOW },
    });
    expect(mocks.createOrderStatusChangedEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fromStatus: "processing", toStatus: "cancelled" }),
    );
    expect(mocks.createOrderNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "order-1", type: "MANUAL_REVIEW" }),
    );
  });

  it("only asks staff to cancel once inside 24h, leaving the status alone", async () => {
    mocks.findCustomerOrder.mockResolvedValue(order({ deliveryDate: "2026-10-06" }));

    const res = await post({ message: "Vi er bortreist" });

    expect(await res.json()).toEqual({ ok: true, mode: "requested" });
    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.not.objectContaining({ status: expect.anything() }) }),
    );
    expect(mocks.emailMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ direction: "INBOUND", bodyText: expect.stringContaining("Vi er bortreist") }) }),
    );
    expect(mocks.createOrderNotification).toHaveBeenCalled();
    expect(mocks.createOrderStatusChangedEvent).not.toHaveBeenCalled();
  });

  it("refuses a closed order", async () => {
    mocks.findCustomerOrder.mockResolvedValue(order({ status: "cancelled" }));
    const res = await post();
    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe("ORDER_CLOSED");
  });
});
