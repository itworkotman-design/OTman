import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindManyMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  createOrderStatusChangedEventMock: vi.fn(),
  sendLifecycleEmailsForOrdersMock: vi.fn(),
  cancelledOrderPartnerDataMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findMany: mocks.orderFindManyMock, update: mocks.orderUpdateMock },
  },
}));

vi.mock("@/lib/orders/orderEvents", () => ({
  createOrderStatusChangedEvent: mocks.createOrderStatusChangedEventMock,
}));

vi.mock("@/lib/orders/sendCustomerLifecycleEmail", () => ({
  sendLifecycleEmailsForOrders: mocks.sendLifecycleEmailsForOrdersMock,
}));

vi.mock("@/lib/orders/cancelledOrderPartner", () => ({
  cancelledOrderPartnerData: mocks.cancelledOrderPartnerDataMock,
}));

import { runPaymentTimeoutSweep } from "./runPaymentTimeoutSweep";

const overdueOrder = {
  id: "order-1",
  companyId: "company-1",
  displayId: 20100,
  status: "approved",
  subcontractorMembershipId: null,
  subcontractor: null,
};

describe("runPaymentTimeoutSweep cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reminder phase finds nothing; cancellation phase finds one overdue order.
    mocks.orderFindManyMock.mockImplementation(async (args: { where: { paymentReminderSentAt?: unknown } }) =>
      args.where.paymentReminderSentAt === null ? [] : [overdueOrder],
    );
    mocks.orderUpdateMock.mockResolvedValue({});
    mocks.createOrderStatusChangedEventMock.mockResolvedValue(undefined);
    mocks.cancelledOrderPartnerDataMock.mockResolvedValue({});
  });

  it("cancels the overdue order and fills the placeholder partner", async () => {
    mocks.cancelledOrderPartnerDataMock.mockResolvedValue({
      subcontractorMembershipId: "membership-cancelled",
      subcontractor: "Kansellert",
    });

    const summary = await runPaymentTimeoutSweep();

    expect(summary.cancelled).toBe(1);
    expect(mocks.cancelledOrderPartnerDataMock).toHaveBeenCalledWith(expect.anything(), {
      companyId: "company-1",
      displayId: 20100,
      previousStatus: "approved",
      nextStatus: "cancelled",
      partner: { subcontractorMembershipId: null, subcontractor: null },
    });
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: {
        status: "cancelled",
        subcontractorMembershipId: "membership-cancelled",
        subcontractor: "Kansellert",
      },
    });
  });

  it("only sets the status when no placeholder applies", async () => {
    await runPaymentTimeoutSweep();

    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "cancelled" },
    });
  });
});
