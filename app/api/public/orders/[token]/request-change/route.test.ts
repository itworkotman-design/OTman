import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrderByActionTokenMock: vi.fn(),
  transactionMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  orderEmailMessageCreateMock: vi.fn(),
  createOrderStatusChangedEventMock: vi.fn(),
  createOrderActionEventMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transactionMock,
    order: { update: mocks.orderUpdateMock },
    orderEmailMessage: { create: mocks.orderEmailMessageCreateMock },
  },
}));

vi.mock("@/lib/orders/publicOrderAccess", async () => {
  const actual = await vi.importActual<typeof import("@/lib/orders/publicOrderAccess")>(
    "@/lib/orders/publicOrderAccess",
  );
  return { ...actual, getOrderByActionToken: mocks.getOrderByActionTokenMock };
});

vi.mock("@/lib/orders/orderEvents", () => ({
  createOrderStatusChangedEvent: mocks.createOrderStatusChangedEventMock,
  createOrderActionEvent: mocks.createOrderActionEventMock,
}));

vi.mock("@/lib/email/gmailAccounts", () => ({
  getGmailSendAsEmail: () => "orders@otman.no",
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://localhost/api/public/orders/abc/request-change", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function call(body: unknown, token = "a".repeat(32)) {
  return POST(req(body), { params: Promise.resolve({ token }) });
}

const baseOrder = {
  id: "order1",
  companyId: "company1",
  email: "customer@example.com",
  customerName: "Test Customer",
  customerLabel: null,
};

describe("POST /api/public/orders/[token]/request-change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transactionMock.mockResolvedValue([{}, {}]);
  });

  it("requires a non-empty message", async () => {
    const res = await call({ message: "  " });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown token", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue(null);
    const res = await call({ message: "Please add a washing machine" });
    expect(res.status).toBe(404);
  });

  it("rejects a processing order (nothing to request a change on yet)", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue({ ...baseOrder, status: "processing" });
    const res = await call({ message: "Please add a washing machine" });
    expect(res.status).toBe(409);
  });

  it("from approved/rejected/failed: flips status to processing and logs a status-changed event, as before", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue({ ...baseOrder, status: "approved" });

    const res = await call({ message: "Please change the date" });

    expect(res.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "processing" }) }),
    );
    expect(mocks.createOrderStatusChangedEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fromStatus: "approved", toStatus: "processing" }),
    );
    expect(mocks.createOrderActionEventMock).not.toHaveBeenCalled();
  });

  it("from confirmed (already paid): accepts the request WITHOUT reverting status away from confirmed, and logs an action event instead", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue({ ...baseOrder, status: "confirmed" });

    const res = await call({ message: "Please also add a washing machine" });

    expect(res.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ needsEmailAttention: true }),
      }),
    );
    // Must NOT set status to "processing" for an already-paid order — that
    // would misrepresent a confirmed/paid order as unapproved/unpaid.
    const updateData = mocks.orderUpdateMock.mock.calls[0][0].data;
    expect(updateData.status).toBeUndefined();
    expect(mocks.createOrderStatusChangedEventMock).not.toHaveBeenCalled();
    expect(mocks.createOrderActionEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "order1" }),
    );
  });
});
