import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  canEditOrdersMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  orderEmailMessageCreateMock: vi.fn(),
  transactionMock: vi.fn(),
  sendEmailMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/users/orderAccess", () => ({
  canEditOrders: mocks.canEditOrdersMock,
}));

vi.mock("@/lib/email/sendEmail", () => ({
  sendEmail: mocks.sendEmailMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
    },
    order: {
      findMany: mocks.orderFindManyMock,
      update: mocks.orderUpdateMock,
    },
    orderEmailMessage: {
      create: mocks.orderEmailMessageCreateMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { POST } from "./route";

describe("POST /api/orders/send-selected-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canEditOrdersMock.mockReturnValue(true);
    mocks.transactionMock.mockImplementation(async (operations: unknown[]) => operations);
  });

  it("returns 400 when the recipient is missing", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
      permissions: [{ permission: "BOOKING_CREATE" }],
    });

    const res = await POST(
      new Request("http://localhost/api/orders/send-selected-email", {
        method: "POST",
        body: JSON.stringify({ orderIds: ["order-1"], to: "" }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "MISSING_RECIPIENT",
    });
  });

  it("sends one email with rendered order content when valid orders are provided", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
      permissions: [{ permission: "BOOKING_CREATE" }],
    });
    mocks.orderFindManyMock.mockResolvedValue([
      {
        id: "order-1",
        orderNumber: "PO-1",
        deliveryDate: "2030-01-15",
        timeWindow: "08-12",
        customerLabel: "Acme",
        customerName: "Alice",
        phone: "12345678",
        pickupAddress: "Pickup 1",
        extraPickupAddress: ["Pickup 2"],
        deliveryAddress: "Delivery 1",
        returnAddress: "",
        productsSummary: "Van",
        cashierName: "Cashier",
        priceExVat: 1000,
      },
    ]);
    mocks.sendEmailMock.mockResolvedValue({ id: "mail-1" });

    const res = await POST(
      new Request("http://localhost/api/orders/send-selected-email", {
        method: "POST",
        body: JSON.stringify({
          orderIds: ["order-1"],
          to: "customer@example.com",
          recipientName: "Alice",
          subject: "Selected orders",
          message: "Here are your orders",
        }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, sentCount: 1 });
    expect(mocks.sendEmailMock).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmailMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        to: { email: "customer@example.com" },
        subject: "Selected orders",
        html: expect.stringContaining("PO-1"),
      }),
    );
  });

  it("stores failed outbound messages so the email center can show the error", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
      permissions: [{ permission: "BOOKING_CREATE" }],
    });
    mocks.orderFindManyMock.mockResolvedValue([
      {
        id: "order-1",
        orderNumber: "PO-1",
        deliveryDate: "2030-01-15",
        timeWindow: "08-12",
        customerLabel: "Acme",
        customerName: "Alice",
        phone: "12345678",
        pickupAddress: "Pickup 1",
        extraPickupAddress: [],
        deliveryAddress: "Delivery 1",
        returnAddress: "",
        productsSummary: "Van",
        cashierName: "Cashier",
        priceExVat: 1000,
      },
    ]);
    mocks.sendEmailMock.mockRejectedValue(new Error("BREVO_REJECTED"));

    const res = await POST(
      new Request("http://localhost/api/orders/send-selected-email", {
        method: "POST",
        body: JSON.stringify({
          orderIds: ["order-1"],
          to: "customer@example.com",
          recipientName: "Alice",
          subject: "Selected orders",
          message: "Here are your orders",
        }),
      }),
    );

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "BREVO_REJECTED",
    });
    expect(mocks.orderEmailMessageCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: "order-1",
          status: "FAILED",
          subject: "Selected orders",
          bodyText: expect.stringContaining("Reason: BREVO_REJECTED"),
        }),
      }),
    );
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: expect.objectContaining({
          needsEmailAttention: true,
        }),
      }),
    );
  });
});
