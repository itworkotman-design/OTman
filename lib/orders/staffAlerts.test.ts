import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindUnique: vi.fn(),
  createOrderNotification: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { order: { findUnique: mocks.orderFindUnique } } }));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: mocks.createOrderNotification }));

import { alertStaff } from "./staffAlerts";

describe("alertStaff — something went wrong that staff must see (the order's Notifications)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds a review notification on the order", async () => {
    await alertStaff({ orderId: "o1", companyId: "c1", title: "Email to customer failed", message: "balance_due: Gmail said no" });

    expect(mocks.createOrderNotification).toHaveBeenCalledWith(expect.anything(), {
      orderId: "o1",
      companyId: "c1",
      type: "MANUAL_REVIEW",
      title: "Email to customer failed",
      message: "balance_due: Gmail said no",
    });
  });

  it("looks up the order's company when the caller doesn't know it", async () => {
    mocks.orderFindUnique.mockResolvedValue({ companyId: "c7" });
    await alertStaff({ orderId: "o1", title: "T", message: "M" });
    expect(mocks.createOrderNotification).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ companyId: "c7" }));
  });

  it("does nothing for an order that isn't there", async () => {
    mocks.orderFindUnique.mockResolvedValue(null);
    await alertStaff({ orderId: "gone", title: "T", message: "M" });
    expect(mocks.createOrderNotification).not.toHaveBeenCalled();
  });

  it("never throws — an alert must not break what it reports on", async () => {
    mocks.createOrderNotification.mockRejectedValue(new Error("db down"));
    await expect(alertStaff({ orderId: "o1", companyId: "c1", title: "T", message: "M" })).resolves.toBeUndefined();
  });
});
