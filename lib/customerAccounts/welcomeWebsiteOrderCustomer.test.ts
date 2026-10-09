import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureCustomerAccountForOrder: vi.fn(),
  sendOrderReceivedEmail: vi.fn(),
  createOrderNotification: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("./ensureCustomerAccount", () => ({ ensureCustomerAccountForOrder: mocks.ensureCustomerAccountForOrder }));
vi.mock("@/lib/orders/sendOrderReceivedEmail", () => ({ sendOrderReceivedEmail: mocks.sendOrderReceivedEmail }));
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
  });

  it("creates the account, then sends ONE email with the username and the password in it", async () => {
    mocks.ensureCustomerAccountForOrder.mockResolvedValue({ accountId: "a1", email: "ola@example.com", newPassword: "Abcdefgh2345" });

    await welcomeWebsiteOrderCustomer(order);

    expect(mocks.ensureCustomerAccountForOrder).toHaveBeenCalledWith({ orderId: "o1", email: "ola@example.com" });
    expect(mocks.sendOrderReceivedEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendOrderReceivedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ ...order, customerLogin: { email: "ola@example.com", password: "Abcdefgh2345" } }),
    );
  });

  it("sends no password to a returning customer who keeps theirs", async () => {
    mocks.ensureCustomerAccountForOrder.mockResolvedValue({ accountId: "a1", email: "ola@example.com", newPassword: null });

    await welcomeWebsiteOrderCustomer(order);

    expect(mocks.sendOrderReceivedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ customerLogin: { email: "ola@example.com", password: null } }),
    );
  });

  it("passes the order details for the table at the end of the email", async () => {
    mocks.ensureCustomerAccountForOrder.mockResolvedValue({ accountId: "a1", email: "ola@example.com", newPassword: null });

    await welcomeWebsiteOrderCustomer({
      ...order,
      deliveryDate: "2026-10-15",
      timeWindow: "10:00-16:00",
      phone: "+47 900 00 000",
      pickupAddress: "Elkjøp Lørenskog",
      extraPickupAddress: ["Power Alnabru"],
      deliveryAddress: "Storgata 1",
      returnAddress: null,
      floorNo: "3",
      lift: "Nei",
      productsSummary: "Washing machine",
      deliveryTypeSummary: "Delivery with carry-in",
      servicesSummary: "",
      customerComments: null,
      priceExVat: 4990,
      rabatt: null,
      leggTil: null,
      pricingSnapshot: null,
      websiteOrderKind: "WHITE_GOODS",
    });

    expect(mocks.sendOrderReceivedEmail.mock.calls[0][0].orderDetails).toEqual({
      deliveryDate: "2026-10-15",
      timeWindow: "10:00-16:00",
      customerName: "Ola",
      phone: "+47 900 00 000",
      email: "ola@example.com",
      pickupAddress: "Elkjøp Lørenskog",
      extraPickupAddress: ["Power Alnabru"],
      deliveryAddress: "Storgata 1",
      returnAddress: null,
      floorNo: "3",
      lift: "Nei",
      productsSummary: "Washing machine",
      deliveryTypeSummary: "Delivery with carry-in",
      servicesSummary: "",
      customerComments: null,
      // A homepage order's priceExVat is already incl. VAT.
      totalIncVatNok: 4990,
    });
  });

  it("gives an unpriced quote no total", async () => {
    mocks.ensureCustomerAccountForOrder.mockResolvedValue(null);

    await welcomeWebsiteOrderCustomer({ ...order, priceExVat: 0 });

    expect(mocks.sendOrderReceivedEmail.mock.calls[0][0].orderDetails.totalIncVatNok).toBeNull();
  });

  it("still sends the order email (without login) when the account can't be created, and alerts staff", async () => {
    mocks.ensureCustomerAccountForOrder.mockRejectedValue(new Error("db down"));

    await welcomeWebsiteOrderCustomer(order);

    expect(mocks.sendOrderReceivedEmail).toHaveBeenCalledWith(expect.objectContaining(order));
    expect(mocks.sendOrderReceivedEmail.mock.calls[0][0].customerLogin).toBeUndefined();
    expect(mocks.createOrderNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "o1", type: "MANUAL_REVIEW" }),
    );
  });

  it("sends just the order email when there is no email to make an account for", async () => {
    mocks.ensureCustomerAccountForOrder.mockResolvedValue(null);

    await welcomeWebsiteOrderCustomer({ ...order, email: null });

    expect(mocks.sendOrderReceivedEmail).toHaveBeenCalledWith(expect.objectContaining({ ...order, email: null }));
    expect(mocks.createOrderNotification).not.toHaveBeenCalled();
  });
});
