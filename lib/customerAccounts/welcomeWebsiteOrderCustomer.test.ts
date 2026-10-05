import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureCustomerAccountForOrder: vi.fn(),
  sendOrderReceivedEmail: vi.fn(),
  sendCustomerCredentialsEmail: vi.fn(),
  createOrderNotification: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("./ensureCustomerAccount", () => ({ ensureCustomerAccountForOrder: mocks.ensureCustomerAccountForOrder }));
vi.mock("@/lib/orders/sendOrderReceivedEmail", () => ({ sendOrderReceivedEmail: mocks.sendOrderReceivedEmail }));
vi.mock("./customerCredentialsEmail", () => ({ sendCustomerCredentialsEmail: mocks.sendCustomerCredentialsEmail }));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: mocks.createOrderNotification }));

import { welcomeWebsiteOrderCustomer } from "./welcomeWebsiteOrderCustomer";

const order = {
  id: "o1",
  companyId: "c1",
  displayId: 42,
  orderNumber: "K7MQ4XZ2",
  customerName: "Ola",
  customerLabel: null,
  statusNotes: null,
  actionToken: null,
  email: "ola@example.com" as string | null,
  emailThreadToken: null,
};

describe("welcomeWebsiteOrderCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.sendCustomerCredentialsEmail.mockResolvedValue(true);
  });

  it("creates the account, then sends the order email with the login block and the password separately", async () => {
    mocks.ensureCustomerAccountForOrder.mockResolvedValue({ accountId: "a1", email: "ola@example.com", newPassword: "Abcdefgh2345" });

    await welcomeWebsiteOrderCustomer(order);

    expect(mocks.ensureCustomerAccountForOrder).toHaveBeenCalledWith({ orderId: "o1", email: "ola@example.com" });
    expect(mocks.sendOrderReceivedEmail).toHaveBeenCalledWith({
      ...order,
      customerLogin: { email: "ola@example.com", hasNewPassword: true },
    });
    expect(mocks.sendCustomerCredentialsEmail).toHaveBeenCalledWith({
      order: { id: "o1", companyId: "c1", displayId: 42, orderNumber: "K7MQ4XZ2", customerName: "Ola" },
      email: "ola@example.com",
      password: "Abcdefgh2345",
    });
  });

  it("sends no password to a returning customer who keeps theirs", async () => {
    mocks.ensureCustomerAccountForOrder.mockResolvedValue({ accountId: "a1", email: "ola@example.com", newPassword: null });

    await welcomeWebsiteOrderCustomer(order);

    expect(mocks.sendOrderReceivedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ customerLogin: { email: "ola@example.com", hasNewPassword: false } }),
    );
    expect(mocks.sendCustomerCredentialsEmail).not.toHaveBeenCalled();
  });

  it("still sends the order email (without login) when the account can't be created, and alerts staff", async () => {
    mocks.ensureCustomerAccountForOrder.mockRejectedValue(new Error("db down"));

    await welcomeWebsiteOrderCustomer(order);

    expect(mocks.sendOrderReceivedEmail).toHaveBeenCalledWith(order);
    expect(mocks.createOrderNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "o1", type: "MANUAL_REVIEW" }),
    );
  });

  it("sends just the order email when there is no email to make an account for", async () => {
    mocks.ensureCustomerAccountForOrder.mockResolvedValue(null);

    await welcomeWebsiteOrderCustomer({ ...order, email: null });

    expect(mocks.sendOrderReceivedEmail).toHaveBeenCalledWith({ ...order, email: null });
    expect(mocks.sendCustomerCredentialsEmail).not.toHaveBeenCalled();
    expect(mocks.createOrderNotification).not.toHaveBeenCalled();
  });
});
