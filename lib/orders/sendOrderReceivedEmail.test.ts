import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendLifecycleEmailsForOrders: vi.fn(),
  createOrderNotification: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/orders/sendCustomerLifecycleEmail", () => ({
  sendLifecycleEmailsForOrders: mocks.sendLifecycleEmailsForOrders,
}));
vi.mock("@/lib/orders/orderNotifications", () => ({
  createOrderNotification: mocks.createOrderNotification,
}));

import { sendOrderReceivedEmail } from "./sendOrderReceivedEmail";

const order = {
  id: "order1",
  companyId: "c1",
  displayId: 42,
  orderNumber: "K7MQ4XZ2",
  customerName: "Ola Nordmann",
  customerLabel: null,
  statusNotes: null,
  actionToken: null,
  email: "ola@example.com" as string | null,
  emailThreadToken: null,
};

describe("sendOrderReceivedEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.sendLifecycleEmailsForOrders.mockResolvedValue({ sentCount: 1, failedOrderIds: [] });
    mocks.createOrderNotification.mockResolvedValue(undefined);
  });

  it("sends an order_received lifecycle email as a system actor", async () => {
    await sendOrderReceivedEmail(order);

    expect(mocks.sendLifecycleEmailsForOrders).toHaveBeenCalledWith({
      orders: [order],
      kind: "order_received",
      actor: { source: "SYSTEM", name: "Website" },
    });
    expect(mocks.createOrderNotification).not.toHaveBeenCalled();
  });

  it("alerts staff when Gmail fails to send it, so the customer is never silently left without confirmation", async () => {
    mocks.sendLifecycleEmailsForOrders.mockResolvedValue({ sentCount: 0, failedOrderIds: ["order1"] });

    await sendOrderReceivedEmail(order);

    expect(mocks.createOrderNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "order1", companyId: "c1", type: "MANUAL_REVIEW", message: expect.stringContaining("K7MQ4XZ2") }),
    );
  });

  it("alerts staff when the send throws outright, and never throws itself", async () => {
    mocks.sendLifecycleEmailsForOrders.mockRejectedValue(new Error("gmail down"));

    await expect(sendOrderReceivedEmail(order)).resolves.toBeUndefined();
    expect(mocks.createOrderNotification).toHaveBeenCalledTimes(1);
  });

  it("alerts staff (instead of silently skipping) when an order somehow has no customer email", async () => {
    await sendOrderReceivedEmail({ ...order, email: null });

    expect(mocks.sendLifecycleEmailsForOrders).not.toHaveBeenCalled();
    expect(mocks.createOrderNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "order1", message: expect.stringContaining("no email") }),
    );
  });

  it("never throws even if raising the staff alert itself fails", async () => {
    mocks.sendLifecycleEmailsForOrders.mockRejectedValue(new Error("gmail down"));
    mocks.createOrderNotification.mockRejectedValue(new Error("db down"));

    await expect(sendOrderReceivedEmail(order)).resolves.toBeUndefined();
  });

  describe("with a new password", () => {
    const withPassword = { ...order, customerLogin: { email: "ola@example.com", password: "WZeMSSoC5EZn" } };

    it("sends it through Gmail like every other order email (never Brevo)", async () => {
      await sendOrderReceivedEmail(withPassword);

      expect(mocks.sendLifecycleEmailsForOrders).toHaveBeenCalledWith({
        orders: [withPassword],
        kind: "order_received",
        actor: { source: "SYSTEM", name: "Website" },
      });
    });

    it("alerts staff to send a new login when it fails, without logging the password", async () => {
      mocks.sendLifecycleEmailsForOrders.mockRejectedValue(new Error("gmail said no to WZeMSSoC5EZn"));

      await expect(sendOrderReceivedEmail(withPassword)).resolves.toBeUndefined();

      expect(mocks.createOrderNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ orderId: "order1", message: expect.stringContaining("Send new login") }),
      );
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("WZeMSSoC5EZn");
    });
  });
});
