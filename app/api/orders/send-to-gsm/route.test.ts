import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  taskUpsertMock: vi.fn(),
  transactionMock: vi.fn(),
  sendOrderToGsmMock: vi.fn(),
  createOrderActionEventMock: vi.fn(),
  attachmentFindManyMock: vi.fn(),
  sendReceiptsToGsmTaskMock: vi.fn(),
}));

vi.mock("@/lib/integrations/gsm/sendReceipts", () => ({
  sendReceiptsToGsmTask: mocks.sendReceiptsToGsmTaskMock,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/integrations/gsm/sendOrder", () => ({
  sendOrderToGsm: mocks.sendOrderToGsmMock,
}));

vi.mock("@/lib/orders/orderEvents", () => ({
  createOrderActionEvent: mocks.createOrderActionEventMock,
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
    orderAttachment: {
      findMany: mocks.attachmentFindManyMock,
    },
    orderGsmTask: {
      upsert: mocks.taskUpsertMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { POST } from "./route";

describe("POST /api/orders/send-to-gsm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transactionMock.mockResolvedValue([]);
    mocks.createOrderActionEventMock.mockResolvedValue(undefined);
    mocks.attachmentFindManyMock.mockResolvedValue([]);
  });

  it("returns 400 when no valid order ids are sent", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
      user: {
        username: "Admin",
        email: "admin@example.com",
      },
    });

    const res = await POST(
      new Request("http://localhost/api/orders/send-to-gsm", {
        method: "POST",
        body: JSON.stringify({ orderIds: [] }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_ORDER_IDS",
    });
  });

  it("resends already synced orders and reports wasAlreadySent", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "OWNER",
      user: {
        username: "Owner",
        email: "owner@example.com",
      },
    });
    mocks.orderFindManyMock.mockResolvedValue([
      {
        id: "order-1",
        gsmOrderId: "gsm-1",
      },
    ]);
    mocks.sendOrderToGsmMock.mockResolvedValue({
      gsmOrderId: "gsm-1",
      tasks: [],
    });

    const res = await POST(
      new Request("http://localhost/api/orders/send-to-gsm", {
        method: "POST",
        body: JSON.stringify({ orderIds: ["order-1"] }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      results: [
        {
          orderId: "order-1",
          ok: true,
          gsmOrderId: "gsm-1",
          wasAlreadySent: true,
        },
      ],
    });
    expect(mocks.sendOrderToGsmMock).toHaveBeenCalled();
    expect(mocks.createOrderActionEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderId: "order-1",
        title: "Order sent for GSM resend",
      }),
    );
  });

  it("doesn't put pickup-document links in the GSM payload (the files are uploaded instead)", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "user-1", activeCompanyId: "company-1" });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "OWNER",
      user: { username: "Owner", email: "owner@example.com" },
    });
    mocks.orderFindManyMock.mockResolvedValue([{ id: "order-1", gsmOrderId: null }]);
    mocks.sendOrderToGsmMock.mockResolvedValue({ gsmOrderId: "gsm-1", tasks: [] });

    await POST(
      new Request("http://localhost/api/orders/send-to-gsm", {
        method: "POST",
        body: JSON.stringify({ orderIds: ["order-1"] }),
      }),
    );

    const sent = mocks.sendOrderToGsmMock.mock.calls[0]![0];
    expect(sent).not.toHaveProperty("pickupDocuments");
  });

  it("updates last edited state and writes an action event when GSM send succeeds", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "OWNER",
      user: {
        username: "Owner",
        email: "owner@example.com",
      },
    });
    mocks.orderFindManyMock.mockResolvedValue([
      {
        id: "order-1",
        gsmOrderId: null,
      },
    ]);
    mocks.sendOrderToGsmMock.mockResolvedValue({
      gsmOrderId: "gsm-1",
      tasks: [],
    });

    const res = await POST(
      new Request("http://localhost/api/orders/send-to-gsm", {
        method: "POST",
        body: JSON.stringify({ orderIds: ["order-1"] }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      results: [
        {
          orderId: "order-1",
          ok: true,
          gsmOrderId: "gsm-1",
          wasAlreadySent: false,
        },
      ],
    });
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: expect.objectContaining({
          lastEditedByMembershipId: "membership-1",
          gsmOrderId: "gsm-1",
        }),
      }),
    );
    expect(mocks.createOrderActionEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderId: "order-1",
        title: "Order sent for GSM",
      }),
    );
  });

  function mockOwnerSendWithTwoTasks() {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "OWNER",
      user: { username: "Owner", email: "owner@example.com" },
    });
    mocks.orderFindManyMock.mockResolvedValue([{ id: "order-1", gsmOrderId: null }]);
    mocks.sendOrderToGsmMock.mockResolvedValue({
      gsmOrderId: "gsm-1",
      tasks: [
        { gsmTaskId: "task-1", category: "pick_up", reference: "r" },
        { gsmTaskId: "task-2", category: "drop_off", reference: "r" },
        { gsmTaskId: "task-3", category: "assignment", reference: "r" },
      ],
    });
  }

  const receipt = {
    id: "att-1",
    filename: "receipt.pdf",
    mimeType: "application/pdf",
    storagePath: "s3://x",
  };

  it("sends dashboard receipts to drop-off and assignment tasks but not pick-up", async () => {
    mockOwnerSendWithTwoTasks();
    mocks.attachmentFindManyMock.mockResolvedValue([{ ...receipt, category: "RECEIPT", source: null }]);
    mocks.sendReceiptsToGsmTaskMock.mockResolvedValue({ sent: 1, skipped: 0 });

    const res = await POST(
      new Request("http://localhost/api/orders/send-to-gsm", {
        method: "POST",
        body: JSON.stringify({ orderIds: ["order-1"] }),
      }),
    );

    expect(mocks.attachmentFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orderId: "order-1",
          OR: [{ category: "RECEIPT" }, { source: "pickup-document" }],
        },
      }),
    );
    expect(mocks.sendReceiptsToGsmTaskMock).toHaveBeenCalledTimes(2);
    expect(mocks.sendReceiptsToGsmTaskMock).toHaveBeenCalledWith({
      gsmTaskId: "task-2",
      receipts: [receipt],
    });
    expect(mocks.sendReceiptsToGsmTaskMock).toHaveBeenCalledWith({
      gsmTaskId: "task-3",
      receipts: [receipt],
    });
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ ok: true, receiptsSent: 2 });
  });

  it("sends a homepage order's pickup documents to every task: pick-up, drop-off and assignment", async () => {
    mockOwnerSendWithTwoTasks();
    const pickupDocument = {
      id: "att-2",
      filename: "Pickup 1 - kvittering.pdf",
      mimeType: "application/pdf",
      storagePath: "s3://y",
    };
    mocks.attachmentFindManyMock.mockResolvedValue([
      { ...pickupDocument, category: "ATTACHMENT", source: "pickup-document" },
    ]);
    mocks.sendReceiptsToGsmTaskMock.mockResolvedValue({ sent: 1, skipped: 0 });

    const res = await POST(
      new Request("http://localhost/api/orders/send-to-gsm", {
        method: "POST",
        body: JSON.stringify({ orderIds: ["order-1"] }),
      }),
    );

    expect(mocks.sendReceiptsToGsmTaskMock).toHaveBeenCalledTimes(3);
    for (const gsmTaskId of ["task-1", "task-2", "task-3"]) {
      expect(mocks.sendReceiptsToGsmTaskMock).toHaveBeenCalledWith({ gsmTaskId, receipts: [pickupDocument] });
    }
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ ok: true, receiptsSent: 3 });
  });

  it("keeps dashboard receipts off the pick-up task when the order also has pickup documents", async () => {
    mockOwnerSendWithTwoTasks();
    const pickupDocument = {
      id: "att-2",
      filename: "Pickup 1 - kvittering.pdf",
      mimeType: "application/pdf",
      storagePath: "s3://y",
    };
    mocks.attachmentFindManyMock.mockResolvedValue([
      { ...receipt, category: "RECEIPT", source: null },
      { ...pickupDocument, category: "ATTACHMENT", source: "pickup-document" },
    ]);
    mocks.sendReceiptsToGsmTaskMock.mockResolvedValue({ sent: 1, skipped: 0 });

    await POST(
      new Request("http://localhost/api/orders/send-to-gsm", {
        method: "POST",
        body: JSON.stringify({ orderIds: ["order-1"] }),
      }),
    );

    expect(mocks.sendReceiptsToGsmTaskMock).toHaveBeenCalledWith({ gsmTaskId: "task-1", receipts: [pickupDocument] });
    expect(mocks.sendReceiptsToGsmTaskMock).toHaveBeenCalledWith({ gsmTaskId: "task-2", receipts: [receipt, pickupDocument] });
    expect(mocks.sendReceiptsToGsmTaskMock).toHaveBeenCalledWith({ gsmTaskId: "task-3", receipts: [receipt, pickupDocument] });
  });

  it("still reports the order as sent when receipt upload fails", async () => {
    mockOwnerSendWithTwoTasks();
    mocks.attachmentFindManyMock.mockResolvedValue([receipt]);
    mocks.sendReceiptsToGsmTaskMock.mockRejectedValue(new Error("S3 upload failed (403)"));

    const res = await POST(
      new Request("http://localhost/api/orders/send-to-gsm", {
        method: "POST",
        body: JSON.stringify({ orderIds: ["order-1"] }),
      }),
    );

    const body = await res.json();
    expect(body.results[0]).toMatchObject({
      ok: true,
      gsmOrderId: "gsm-1",
      receiptError: "S3 upload failed (403)",
    });
    expect(mocks.orderUpdateMock).toHaveBeenCalled();
  });
});
