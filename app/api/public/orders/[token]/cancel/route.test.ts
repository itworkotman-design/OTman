import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrderByActionTokenMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  orderUpdateManyMock: vi.fn(),
  createOrderStatusChangedEventMock: vi.fn(),
  findCancelledOrderPartnerMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { update: mocks.orderUpdateMock, updateMany: mocks.orderUpdateManyMock },
  },
}));

vi.mock("@/lib/orders/publicOrderAccess", () => ({
  getOrderByActionToken: mocks.getOrderByActionTokenMock,
}));

vi.mock("@/lib/orders/orderEvents", () => ({
  createOrderStatusChangedEvent: mocks.createOrderStatusChangedEventMock,
}));

vi.mock("@/lib/orders/cancelledOrderPartner", () => ({
  findCancelledOrderPartner: mocks.findCancelledOrderPartnerMock,
}));

import { POST } from "./route";

function cancel() {
  return POST(new Request("http://localhost/api/public/orders/tok/cancel", { method: "POST" }), {
    params: Promise.resolve({ token: "tok" }),
  });
}

describe("POST /api/public/orders/[token]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrderByActionTokenMock.mockResolvedValue({
      id: "order-1",
      companyId: "company-1",
      status: "approved",
    });
    mocks.orderUpdateMock.mockResolvedValue({});
    mocks.orderUpdateManyMock.mockResolvedValue({ count: 1 });
    mocks.createOrderStatusChangedEventMock.mockResolvedValue(undefined);
    mocks.findCancelledOrderPartnerMock.mockResolvedValue(null);
  });

  it("returns 409 for an order that can't be cancelled", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue({
      id: "order-1",
      companyId: "company-1",
      status: "completed",
    });

    const res = await cancel();

    expect(res.status).toBe(409);
    expect(mocks.orderUpdateMock).not.toHaveBeenCalled();
  });

  it("cancels the order and fills the placeholder partner only where none is set", async () => {
    mocks.findCancelledOrderPartnerMock.mockResolvedValue({
      subcontractorMembershipId: "membership-cancelled",
      subcontractor: "Kansellert",
    });

    const res = await cancel();

    expect(res.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "cancelled" },
    });
    expect(mocks.findCancelledOrderPartnerMock).toHaveBeenCalledWith(expect.anything(), "company-1");
    expect(mocks.orderUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: "order-1",
        subcontractorMembershipId: null,
        OR: [{ subcontractor: null }, { subcontractor: "" }],
      },
      data: { subcontractorMembershipId: "membership-cancelled", subcontractor: "Kansellert" },
    });
  });

  it("does not touch the partner of a legacy order (display id below 20000)", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue({
      id: "order-1",
      companyId: "company-1",
      displayId: 1234,
      status: "approved",
    });
    mocks.findCancelledOrderPartnerMock.mockResolvedValue({
      subcontractorMembershipId: "membership-cancelled",
      subcontractor: "Kansellert",
    });

    const res = await cancel();

    expect(res.status).toBe(200);
    expect(mocks.orderUpdateManyMock).not.toHaveBeenCalled();
  });

  it("skips the partner fill when no placeholder is configured", async () => {
    const res = await cancel();

    expect(res.status).toBe(200);
    expect(mocks.orderUpdateManyMock).not.toHaveBeenCalled();
  });
});
