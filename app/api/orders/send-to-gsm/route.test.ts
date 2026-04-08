import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  taskUpsertMock: vi.fn(),
  transactionMock: vi.fn(),
  sendOrderToGsmMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/integrations/gsm/sendOrder", () => ({
  sendOrderToGsm: mocks.sendOrderToGsmMock,
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
  });

  it("returns 400 when no valid order ids are sent", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "ADMIN" });

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

  it("skips already synced orders unless force is enabled", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "OWNER" });
    mocks.orderFindManyMock.mockResolvedValue([
      {
        id: "order-1",
        gsmOrderId: "gsm-1",
      },
    ]);

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
          ok: false,
          error: "ALREADY_SENT_TO_GSM",
        },
      ],
    });
    expect(mocks.sendOrderToGsmMock).not.toHaveBeenCalled();
  });
});
